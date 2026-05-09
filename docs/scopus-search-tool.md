# Scopus Search Tool

Tool untuk mencari artikel akademik di database Scopus berdasarkan judul, abstrak, keyword, atau penulis.

## Fitur

✅ **Dapat digunakan oleh SEMUA model** - Tidak bergantung pada kemampuan native model  
✅ **Search berdasarkan query** - Bukan hanya fetch URL spesifik  
✅ **Hasil terstruktur** - Title, authors, publication, citations, abstract, DOI  
✅ **Pagination** - Bisa navigate melalui hasil dengan `start` dan `count`  
✅ **Sorting** - Sort by relevancy, date, citations, dll  
✅ **Boolean queries** - Support operator AND, OR, NOT

## Setup

### 1. Dapatkan API Key (GRATIS)

1. Kunjungi: https://dev.elsevier.com/
2. Klik "Get API Key"
3. Login/Register akun Elsevier
4. Copy API key Anda

### 2. Tool Sudah Terinstall

Tool sudah terdaftar otomatis di Vibe Code. Tidak perlu setup tambahan.

## Cara Penggunaan

### Basic Usage

Model AI akan menggunakan tool ini otomatis ketika Anda minta cari paper akademik.

**Contoh prompt user:**

```
Cari paper tentang machine learning di Scopus
```

**Model AI akan memanggil:**

```json
{
  "tool": "scopus_search",
  "params": {
    "query": "machine learning",
    "apiKey": "YOUR_API_KEY",
    "count": 10
  }
}
```

### Advanced Usage

#### 1. Search dengan Field-Specific Query

```
TITLE-ABS-KEY(artificial intelligence)  // Search di title, abstract, keywords
authlname(Einstein)                      // Search by author name
affilcity(Jakarta)                       // Search by city
```

#### 2. Boolean Queries

```
"deep learning" AND "medical imaging"
"cancer" NOT "lung cancer"
"machine learning" OR "artificial intelligence"
```

#### 3. Pagination

Untuk melihat hasil berikutnya:

- `start`: 0 (default), 10, 20, dst
- `count`: 1-25 (max 25 per request)

#### 4. Sorting

Options:

- `relevancy` (default)
- `+coverDate` (ascending by date)
- `-coverDate` (descending by date)
- `+citedby-count` (most cited first)
- `creator`
- `publicationName`
- `pubyear`

Prefix `+` = ascending, `-` = descending

## Output Format

Tool mengembalikan hasil dalam markdown format:

```markdown
# Scopus Search Results

**Total results:** 1234
**Showing:** 10 results
**Query:** machine learning

## 1. Deep Learning in Healthcare

**Authors:** Smith, J., Doe, A.
**Publication:** Nature Medicine
**Date:** 2024-01-15
**DOI:** 10.1234/test
**Cited by:** 42

**Abstract:**
This is the abstract text...

**Link:** https://www.scopus.com/inward/record.url?...
```

## Contoh Output API Response

```json
{
  "search-results": {
    "opensearch:totalResults": "1234",
    "entry": [
      {
        "dc:title": "Deep Learning in Healthcare",
        "dc:creator": { "text-item": [{"$": "Smith, J."}] },
        "prism:publicationName": "Nature Medicine",
        "prism:coverDate": "2024-01-15",
        "prism:doi": "10.1234/test",
        "citedby-count": "42",
        "prism:abstract": "This is the abstract...",
        "prism:url": "https://www.scopus.com/record/...",
        "link": [...]
      }
    ]
  }
}
```

## Batasan

- **Max 25 results** per request
- **API key required** (gratis dari Elsevier)
- **Rate limit** tergantung tier API key Anda
- **Tidak full-text** - hanya metadata + abstract

## Troubleshooting

### Error: "Invalid API key"

- Pastikan API key benar dari dev.elsevier.com
- API key case-sensitive

### Error: "No results found"

- Coba query yang lebih umum
- Cek spelling
- Gunakan field specifier (TITLE-ABS-KEY, authlname, dll)

### Error: "Request failed"

- Cek koneksi internet
- Scopus API mungkin sedang down
- Coba lagi nanti

## Perbedaan dengan WebFetch

| Feature    | ScopusSearch        | WebFetch              |
| ---------- | ------------------- | --------------------- |
| Search     | ✅ Keyword-based    | ❌ URL-specific       |
| Database   | ✅ Scopus academic  | ❌ Generic web        |
| Structured | ✅ Metadata lengkap | ❌ Raw content        |
| Auth       | ✅ API key          | ❌ None (public URLs) |

## Files Modified

- `packages/core/src/tools/scopus-search.ts` - Main implementation
- `packages/core/src/tools/scopus-search.test.ts` - Unit tests
- `packages/core/src/tools/tool-names.ts` - Added SCOPUS_SEARCH constants
- `packages/core/src/tools/tool-error.ts` - Added SCOPE_SEARCH_FAILED error
- `packages/core/src/config/config.ts` - Tool registration
- `packages/core/src/index.ts` - Export types
