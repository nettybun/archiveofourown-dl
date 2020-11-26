# Bookmark web scraping for A03

Downloads metadata for all works in your bookmarks. Works for any public
bookmarks, and has a `login()` method to access your private ones too. Data is
collected in the format below, but can be exported as JSON or CSV.

Let me know if you'd like to see any other fields or new pages that can be
downloaded. I don't actually use A03, so I'm flying a bit blind here...

## Data

```json
{
  "title": "Typical Spicy Eyerolling Fic Name",
  "author": "CleverNameHere",
  "url": "/works/1778...",
  "bookmarkVisibility": "Private Bookmark",
  "bookmarkPage": 2,
  "bookmarkIndex": 10,
  "bookmarkDateTime": "22 Nov 2020",
  "boxContentRating": "Explicit",
  "boxRelationships": "M/M",
  "boxContentWarnings": "No Archive Warnings Apply",
  "boxStatus": "Complete Work",
  "fandoms": [
    "Plants",
    "Animals"
  ],
  "publishDateTime": "10 Feb 2019",
  "tags": {
    "warnings": [
      "No Archive Warnings Apply"
    ],
    "relationships": [
      "Lullaby/Eve"
    ],
    "characters": [
      "Lullaby",
      "Eve"
    ],
    "freeforms": [
      "Fake/Pretend Relationship",
      "Trope Subversion",
      "Wow people really write anything in these tags..."
    ]
  },
  "language": "English",
  "words": "4,020",
  "chapters": "1/1",
  "collections": "",
  "comments": "1255",
  "kudos": "2800",
  "bookmarks": "375",
  "hits": "158800"
}
```

## Usage

Call these methods from your REPL, or uncomment the `main()` call at the end.

- state
- authenticityToken
- login
- saveAllBookmarkedWorks
- exportUserBookmarksToCSV
- exportStateJSON
- importStateJSON

```bash
$ node -r ./index.js
Welcome to Node.js v14.2.0.
Type ".help" for more information.
> saveAllBookmarkedWorks('Juniper')
#0: https://archiveofourown.org/users/Juniper/bookmarks
Promise { <pending> }
#0: 200 OK: https://archiveofourown.org/users/Juniper/bookmarks

     1 - 20 of 389 Bookmarks by Juniper

389 bookmarks across 20 pages
Bookmark page 📖 1/20
1 Nice Title
2 Look Another Spicy Title
3 Heyyy
...
Bookmark page 📖 2/20
...
Done ✨✨✨
> exportUserBookmarksToCSV('Juniper', `Juniper's Bookmarks.csv`)
Exported CSV to disk at "/path/to/Juniper's Bookmarks.csv" (22.8kb)
> ^D
$
```
