const nodeFetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const jsoncsv = require('json2csv');

let reqId = 0;
const fetch = async (url, ...args) => {
  const req = reqId++;
  console.log(`#${req}: ${url}`);
  const res = await nodeFetch(url, ...args);
  console.log(`#${req}: ${res.status} ${res.statusText}: ${url}`);
  return res;
};

process.on('unhandledRejection', (rejection) => { throw rejection; });

const state = {
  authenticityToken: '',
  cookies: '',
  bookmarkedWorks: {
    // [userId]: [
    //   { title, author, url, status, ... (see code) }
    // ]
  },
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:83.0) Gecko/20100101 Firefox/83.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-CA,en-US;q=0.7,en;q=0.3',
  'Upgrade-Insecure-Requests': '1',
  'Connection': 'keep-alive',
  'Cookie': state.cookies,
};

// This is only actually important during setup/login
const saveLoginCookies = (res) => {
  const raw = res.headers.raw()['set-cookie'];
  state.cookies = raw.map(entry => {
    const [cookiePart] = entry.split(';');
    return cookiePart;
  }).join(';');
  console.log(`New cookie string 🍪 ${state.cookies.length} chars`);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Find an "authenticity token" in the page (any page) since it's not a cookie
const authenticityToken = async () => {
  const res = await fetch('https://archiveofourown.org', { headers });
  const html = await res.text();
  const $ = cheerio.load(html);
  state.authenticityToken = $('input[name=authenticity_token]').val();
  console.log(`Set authToken: "${state.authenticityToken}"`);
};

const login = async (username, password) => {
  if (!username || !password) {
    throw 'Use login(\'username\', \'password\')';
  }
  if (!state.authenticityToken) {
    await authenticityToken();
  }
  const loginForm = {
    'utf8': '✓',
    'authenticity_token': state.authenticityToken,
    'user[login]': username,
    'user[password]': password,
    'user[remember_me]': '1',
    'commit': 'Log+in',
  };
  const body = Object.keys(loginForm)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(loginForm[key])}`)
    .join('&');

  const res = await fetch('https://archiveofourown.org/users/login', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  saveLoginCookies(res);
  const html = await res.text();
  // Doesn't use HTTP status codes, so check text
  if (html.includes('The password or user name you entered doesn\'t match our records.')) {
    console.log('Login failed; check password');
  } else {
    console.log('OK');
  }
};

const saveAllBookmarkedWorks = async (userId, maxPages = 50) => {
  if (!userId) {
    throw 'Use saveAllBookmarkedWorks(\'username\', 20)';
  }
  const url = `https://archiveofourown.org/users/${userId}/bookmarks`;
  const res = await fetch(url, { headers });

  if (res.status === 404) {
    console.log(`No such user? "${userId}" was 404`);
    return;
  }
  if (!state.bookmarkedWorks[userId]) {
    state.bookmarkedWorks[userId] = [];
  }

  // Reuse these as `let`
  let html = await res.text();
  let $ = cheerio.load(html);

  const elPages = $('ol.pagination:first-of-type > li');
  const elLastPage = $(elPages.get(elPages.get().length - 2));
  const lastPage = elLastPage.text();

  const bookmarkHeader = $('div#main > h2.heading').text();
  console.log(bookmarkHeader);
  let [match, totalCount] = bookmarkHeader.match(/of (\d+) Bookmarks by/);
  console.log(`${totalCount} bookmarks across ${lastPage} pages`);

  const pages = Math.min(lastPage, maxPages);
  for (let page = 1, count = 0; page <= pages; page++) {
    console.log(`Bookmark page 📖 ${page}/${lastPage}`);
    if (!html) {
      // Don't get banned from the server...
      await sleep(4000);
      const res = await fetch(url + `?page=${page}`, { headers });
      html = await res.text();
      $ = cheerio.load(html);
    }
    $('ol.bookmark > li.bookmark').each((i, el) => {
      const t = (selector) => $(selector, el).text();
      const elTitle = $('h4 > a[href^="/works"]', el);
      const elRequiredTags = $('ul.required-tags', el);
      const elTags = $('ul.tags > li', el);

      const [
        boxContentRating,
        boxContentWarnings,
        boxRelationships,
        boxStatus,
      ] = elRequiredTags.text().trim().split('\n').map(x => x.trim());

      const tagsByGroup = {};
      elTags.each((i, el) => {
        const $e = $(el);
        const [group] = ($e.attr('class') || '?').split(' ');
        if (!tagsByGroup[group]) {
          tagsByGroup[group] = [];
        }
        tagsByGroup[group].push($e.text());
      });

      const work = {
        title: elTitle.text(),
        author: t('a[rel=author]'),
        url: elTitle.attr('href'),

        // This isn't part of a "work" but...
        bookmarkVisibility: t('p.status span.text'),
        bookmarkPage: page,
        bookmarkIndex: count++,
        bookmarkDateTime: t('div.user.module.group > p.datetime'),

        // The box in the top left
        boxContentRating,
        boxRelationships,
        boxContentWarnings,
        boxStatus,

        fandoms:  $('h5.fandoms > a.tag', el).map((i, el) => $(el).text()).toArray(),
        publishDateTime: t('div.header.module > p.datetime'),
        tags: tagsByGroup,
        language: t('dd.language'),
        words: t('dd.words'),
        chapters: t('dd.chapters'),
        collections: t('dd.collections'),
        comments: t('dd.comments'),
        kudos: t('dd.kudos'),
        bookmarks: t('dd.bookmarks'),
        hits: t('dd.hits'),
      };

      console.log(count, work.title);
      state.bookmarkedWorks[userId].push(work);
    });
    // Load the next page...
    html = undefined;
  }
  console.log('Done ✨✨✨');
};

const datasize = (content) => {
  const i = Math.floor(Math.log(content.length) / Math.log(1024));
  return (content.length / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'Kb', 'Mb'][i];
};

const exportUserBookmarksToCSV = async (userId, file = 'bookmarks.csv') => {
  if (!userId) {
    throw 'Use exportUserBookmarksToCSV(\'username\', \'bookmarks.csv\')';
  }
  const works = state.bookmarkedWorks[userId];
  if (!works) {
    throw 'No bookmarks for this user';
  }

  const fields = [
    'title',
    'author',
    'url',
    'bookmarkVisibility',
    'bookmarkPage',
    'bookmarkIndex',
    'bookmarkDateTime',
    'boxContentRating',
    'boxRelationships',
    'boxContentWarnings',
    'boxStatus',
    'fandoms',
    'publishDateTime',
    'tags.warnings',
    'tags.relationships',
    {
      label: 'tags.characters',
      value: (row) => row.tags.characters ? row.tags.characters.join(', ') : '',
    },
    {
      label: 'tags.freeforms',
      value: (row) => row.tags.freeforms ? row.tags.freeforms.join(', ') : '',
    },
    'language',
    'words',
    'chapters',
    'collections',
    'comments',
    'kudos',
    'bookmarks',
    'hits',
  ];

  const jsoncsvParser = new jsoncsv.Parser({ fields });
  const csv = jsoncsvParser.parse(works);

  const as = path.resolve(file);
  await fs.writeFile(as, csv, 'utf-8');
  const filesize = datasize(csv);
  console.log(`Exported CSV to disk at "${as}" (${filesize})`);
};

const exportStateJSON = async (file = 'state.json') => {
  const as = path.resolve(file);
  const serialized = JSON.stringify(state, null, 2);
  await fs.writeFile(as, serialized, 'utf-8');
  const filesize = datasize(serialized);
  console.log(`Exported state to disk at "${as}" (${filesize})`);
};

const importStateJSON = async (file = 'state.json') => {
  const as = path.resolve(file);
  const content = JSON.parse(await fs.readFile(as, 'utf-8'));
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  for (const key of Object.keys(content)) {
    state[key] = content[key];
  }
  console.log('Imported state', state);
};

// Support running in the REPL to explore the dataset
// $ npm i
// $ node -r ./index.js
// > authenticityToken(); // If you're doing private bookmark things...
// > saveAllBookmarkedWorks('YourUsername');
// > exportState();

Object.assign(global, {
  state,
  authenticityToken,
  login,
  saveAllBookmarkedWorks,
  exportUserBookmarksToCSV,
  exportStateJSON,
  importStateJSON,
});

// Support directly running
// $ node ./index.js
const main = async (userId, password) => {
  if (password) {
    await login(userId, password);
  }
  await saveAllBookmarkedWorks(userId);
  await exportStateJSON();
  await exportUserBookmarksToCSV(userId, `${userId}.csv`);
};

// main('YourUsername');
