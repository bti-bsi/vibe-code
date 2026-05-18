---
name: humanize
description: |
  Rewrites AI-generated text to sound natural, humble, and human-written.
  Removes overclaiming, overjudgment, robotic patterns, and hallucination-prone language.
  Enforces fact-based, conversational, and professionally humble tone.
  Use this skill when user asks to humanize text, de-AI a draft, remove AI patterns,
  make writing sound less robotic, or rewrite content to feel more grounded and trustworthy.
  Trigger on: "humanize this", "sounds too AI", "make it more natural", "remove AI tone",
  "too overclaiming", "too formal", "rewrite this draft", "de-slop this".
argument-hint: '<text-to-humanize>'
allowedTools:
  - read_file
  - write_file
  - edit
  - search_web
  - web_fetch
---

# Human-Like Writing Style

Panduan ini untuk menghasilkan tulisan yang terasa natural, jujur, berbasis fakta, dan tidak terdengar seperti output AI generik. Tulisan yang baik tidak perlu overclaim, tidak perlu banyak penegasan dramatis, dan tidak perlu terdengar seperti sedang menjual sesuatu.

## Proses Kerja

1. Periksa apakah ada voice sample dari user. Jika ada, analisis dulu sebelum menulis ulang.
2. Scan seluruh teks untuk pola AI di bawah ini.
3. Tulis ulang. Jangan sekadar hapus pola buruk, tapi isi dengan substansi nyata.
4. Lakukan self-audit: tanyakan "apa yang masih terasa AI di sini?" dan catat.
5. Tulis versi final setelah memperbaiki audit.
6. Format output: Draft pertama, catatan audit, versi final.

---

## Voice Calibration

Jika user memberikan contoh tulisan mereka sendiri, analisis dulu:

- Pola panjang kalimat (pendek dan padat? panjang mengalir? campuran?)
- Level pemilihan kata (santai? akademis? di antara keduanya?)
- Cara memulai paragraf (langsung masuk atau memberi konteks dulu?)
- Kebiasaan transisi (pakai penghubung eksplisit atau langsung lanjut?)
- Frasa atau kata yang sering muncul (verbal tics)

Setelah analisis, sesuaikan tulisan ulang dengan suara mereka, bukan sekadar menghapus pola AI.

Jika tidak ada sample: gunakan default voice di bawah ini.

---

## Default Voice

Tulisan tanpa karakter sama jeleknya dengan AI slop. Tambahkan substansi:

- Punya pendapat. Bereaksi terhadap fakta, jangan hanya melaporkan.
- Variasikan ritme. Kalimat pendek dan padat. Lalu yang lebih panjang dan mengalir. Campurkan.
- Akui kompleksitas. "Ini menarik tapi juga punya batas" lebih baik dari daftar pro/kontra netral.
- Gunakan "saya" bila tepat. Sudut pandang pertama jujur dan tidak terasa tidak profesional.
- Biarkan sedikit ketidaksempurnaan masuk. Struktur terlalu sempurna justru terasa algoritmik.
- Spesifik soal ketidakpastian. Bukan "ini mengkhawatirkan" tapi jelaskan apa tepatnya yang jadi masalah.

---

## Prinsip Inti

### 1. Variasi Struktur Kalimat

Campurkan kalimat pendek dan panjang. Hindari pola subjek-predikat-objek yang identik berulang-ulang.

Contoh buruk: "Produk ini sangat bagus. Produk ini mudah digunakan. Produk ini murah."

Contoh baik: "Produk ini mudah dipakai dan harganya masih masuk akal. Salah satu nilai plusnya ada di kemudahan setup awal."

### 2. Tambahkan Nuansa dan Konteks

Tulisan manusia punya preferensi ringan, observasi situasional, dan ketidakpastian yang wajar. Gunakan ungkapan seperti:

- "Dalam beberapa kasus..."
- "Biasanya..."
- "Untuk penggunaan harian..."
- "Menurut saya..."
- "Yang menarik di sini..."
- "Sejauh yang saya tahu..."

### 3. Hindari Bahasa Terlalu Formal

Gunakan bahasa yang lebih conversational jika konteks memungkinkan.

Contoh buruk: "Dengan demikian, implementasi sistem memberikan efisiensi signifikan."

Contoh baik: "Jadi, sistem ini bikin proses kerja jadi lebih cepat dari sebelumnya."

### 4. Gunakan Transisi Natural

Sesekali gunakan transisi informal untuk jeda logis. Hindari terlalu sempurna dan mekanis.

Contoh transisi yang terasa manusiawi: "Menariknya...", "Yang sering dilupakan...", "Sebenarnya...", "Nah, di sinilah...", "Tapi ada satu hal..."

Tetap profesional dan jangan berlebihan.

---

## Pola AI yang Harus Dihapus

### A. Overclaiming dan Inflasi Signifikansi

Kata-kata berikut cenderung lebih besar dari kenyataan dan perlu dihilangkan atau diganti fakta spesifik:

_revolusioner, groundbreaking, transformatif, mengubah segalanya, belum pernah ada sebelumnya, luar biasa, sangat signifikan, dampak masif, milestone bersejarah, terobosan besar, vital, pivotal, crucial, stands as a testament, marks a shift, indelible mark, evolving landscape_

Gantikan dengan apa yang benar-benar terjadi. Jika tidak ada data spesifik yang mendukung klaim, jangan buat klaim itu.

Contoh buruk: "Teknologi ini merevolusi cara manusia berkomunikasi."

Contoh baik: "Teknologi ini mempersingkat waktu respons rata-rata dari beberapa jam menjadi hitungan menit, berdasarkan laporan penggunaan internal mereka."

### B. Overjudgment dan Penilaian Berlebihan

Hindari frasa yang terdengar seperti hakim atau komentator dramatis, terutama tanpa dasar data:

_jelas sekali, tidak diragukan lagi, sudah terbukti, semua orang tahu, faktanya adalah, tidak ada yang bisa menyangkal, nyata adanya, ini bukan sekadar opini, yang sebenarnya terjadi adalah, kebenaran yang sering diabaikan_

Gantikan dengan kalimat yang lebih terbuka: "ada indikasi bahwa...", "data menunjukkan...", "berdasarkan X..."

### C. Promotional Language

Kata-kata yang terdengar seperti iklan atau brosur:

_boasts, vibrant, rich (figuratif), profound, nestled, in the heart of, breathtaking, must-visit, stunning, state-of-the-art, cutting-edge, world-class, best-in-class_

Gantikan dengan fakta spesifik dan netral.

### D. Atribusi Kabur

Hindari sumber yang tidak bisa diverifikasi:

_para ahli berpendapat, pengamat mencatat, laporan industri menunjukkan, berbagai kalangan, banyak yang percaya, beberapa sumber menyebut_

Solusinya: sebutkan nama sumber spesifik dengan tahun, atau hapus klaim tersebut sepenuhnya.

Contoh buruk: "Para ahli menyebut ini sebagai pendekatan terbaik."

Contoh baik: "Menurut tinjauan Cochrane 2023 tentang metode X, pendekatan ini menunjukkan hasil yang lebih konsisten dibanding kontrol."

---

## Pola Bahasa dan Tata Kalimat

### E. Kosakata AI yang Terlalu Sering Muncul

Kata-kata berikut sering muncul berlebihan di tulisan AI:

_actually, additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate, key (adj), landscape (abstrak), pivotal, showcase, tapestry (abstrak), testament, underscore (verb), valuable, vibrant, comprehensive, robust, seamless, streamline, holistic, leverage (verb)_

Potong atau ganti dengan kata yang lebih sederhana dan langsung.

### F. Hindari Em Dash dan Titik Koma sebagai Jeda Dramatis

Em dash yang dipakai sebagai jeda dramatis atau untuk efek retoris adalah ciri kuat tulisan AI.

Contoh buruk: "Hasilnya memang mengejutkan — bahkan tim peneliti sendiri tidak menduganya — dan membuka pertanyaan baru."

Contoh baik: "Hasilnya cukup mengejutkan. Bahkan tim peneliti sendiri tidak menduganya, dan temuan ini membuka pertanyaan baru."

Titik koma juga sering dipakai AI untuk menyambung kalimat yang seharusnya dipisah menjadi dua kalimat berbeda.

Contoh buruk: "Model ini performanya baik; namun masih ada beberapa keterbatasan."

Contoh baik: "Model ini performanya baik. Namun masih ada beberapa keterbatasan yang perlu diperhatikan."

Gunakan tanda koma, titik, atau mulai kalimat baru sebagai gantinya.

### G. Parallelisme Negatif dan Fragmentasi

Pola _"Bukan hanya soal X, tapi juga Y"_ atau _"Tidak hanya... tapi..."_ adalah ciri AI.

Gantikan dengan pernyataan langsung. Langsung nyatakan poinnya.

### H. Variasi Sinonim Berlebihan

Pola: protagonis, karakter utama, tokoh sentral, pahlawan (semua merujuk hal sama).

Pilih satu kata dan gunakan konsisten.

### I. Passive Voice Tanpa Subjek

Contoh buruk: "Konfigurasi tidak diperlukan." "Hasil tersimpan secara otomatis."

Contoh baik: "Kamu tidak perlu konfigurasi apa-apa." "Sistem menyimpan hasil secara otomatis."

---

## Pola Komunikasi

### J. Pembuka Chatbot

Hapus sepenuhnya:

_"Pertanyaan bagus!", "Tentu saja!", "Dengan senang hati!", "Semoga ini membantu!", "Berikut adalah...", "Izinkan saya menjelaskan...", "Baik, mari kita mulai..."_

Langsung masuk ke isi.

### K. Disclaimer Pengetahuan Palsu

Hapus atau ganti dengan fakta:

_"Berdasarkan informasi yang tersedia...", "Sejauh yang saya ketahui...", "Mungkin sudah berubah...", "Data terbaru mungkin berbeda..."_

Jika informasi tidak tersedia atau tidak pasti, katakan dengan jelas: "Saya tidak tahu ini dengan pasti" atau "Perlu verifikasi lebih lanjut."

### L. Signposting Tidak Perlu

_"Mari kita bahas...", "Berikut yang perlu Anda ketahui...", "Tanpa basa-basi lagi...", "Mari kita selami topik ini..."_

Langsung mulai isinya.

---

## Tone Humble dan Berbasis Fakta

### Humble Tone

Tulisan yang humble bukan berarti meragukan segalanya. Artinya proporsional antara klaim dan bukti yang ada.

Gunakan:

- "Berdasarkan data X, terlihat bahwa..."
- "Salah satu kemungkinan penjelasannya adalah..."
- "Ini bukan satu-satunya faktor, tapi..."
- "Perlu dicatat bahwa konteks Y bisa berbeda..."
- "Saya belum yakin sepenuhnya soal ini..."

Hindari:

- "Sudah terbukti bahwa..."
- "Jelas sekali..."
- "Tidak ada keraguan bahwa..."
- "Ini adalah solusi terbaik..."

### Berbasis Fakta dan Anti-Halusinasi

Jangan pernah membuat klaim yang tidak bisa diverifikasi hanya untuk membuat tulisan terdengar lebih berbobot. Lebih baik jujur dan sederhana daripada terdengar berwibawa tapi tidak akurat.

Aturan praktis:

- Jika tidak ada angka atau sumber yang bisa dikutip, jangan buat angka atau sumber.
- Jika tidak tahu persis, gunakan frasa yang mencerminkan ketidakpastian itu.
- Lebih baik mengatakan "belum ada data yang cukup tentang ini" daripada mengarang data.
- Jika data tersedia, sebutkan dengan spesifik: sumber, tahun, konteks.

Contoh buruk: "Penelitian menunjukkan bahwa 70% pengguna merasa lebih produktif setelah menggunakan tool ini."

Contoh baik: "Dalam survei internal mereka terhadap 200 pengguna di 2024, sekitar 68% melaporkan peningkatan efisiensi kerja setelah adopsi tool ini."

---

## Filler dan Hedging

### Frase Filler yang Harus Dihapus

| Sebelum                                | Sesudah                  |
| -------------------------------------- | ------------------------ |
| Dalam rangka untuk mencapai tujuan ini | Untuk mencapai ini       |
| Dikarenakan oleh fakta bahwa           | Karena                   |
| Pada saat ini                          | Sekarang                 |
| Dalam hal ini                          | Di sini                  |
| Perlu dicatat bahwa                    | (hapus)                  |
| Tidak dapat dipungkiri bahwa           | (hapus atau ganti fakta) |
| Sudah menjadi rahasia umum bahwa       | (hapus)                  |

### Hedging Berlebihan

_"mungkin bisa jadi berpotensi mengarah pada kemungkinan bahwa..."_

Gantikan dengan: "tampaknya ada pengaruh pada..." atau "ada kemungkinan bahwa..."

### Kesimpulan Generik

_"Masa depan tampak cerah.", "Waktu yang menarik ada di depan.", "Sebuah langkah besar ke arah yang benar."_

Gantikan dengan satu fakta konkret tentang apa yang akan terjadi berikutnya, atau hentikan tulisan lebih awal.

---

## Struktur Format

### Hindari Bold Berlebihan

Bold mekanis di tengah kalimat adalah ciri AI. Hapus bold. Jika frasa butuh penekanan, restrukturisasi kalimatnya.

### Hindari Terlalu Banyak Bullet Point

Bullet point berlebihan membuat tulisan terasa seperti daftar tugas bukan tulisan manusia. Integrasikan ke dalam prosa jika bisa.

### Heading Title Case Berlebihan

Contoh buruk: "## Strategi Negosiasi Dan Kemitraan Global"

Contoh baik: "## Strategi negosiasi dan kemitraan global"

---

## Editing Pass Sebelum Final

1. Baca ulang dengan suara. Jika ada bagian yang terasa canggung diucapkan, tulis ulang.
2. Hapus semua kalimat yang hanya mengulang heading.
3. Variasikan panjang kalimat.
4. Ganti setiap em dash dengan tanda koma, titik, atau kalimat baru.
5. Ganti setiap titik koma yang dipakai sebagai jeda dengan titik atau koma.
6. Hapus atau ganti semua klaim tanpa dasar fakta.
7. Pastikan tidak ada atribusi kabur.
8. Pastikan tulisan tetap jelas dan mudah dipahami sekali baca.

---

## Format Output

```
**Draft pertama:**
[teks yang ditulis ulang]

**Pola AI yang masih tersisa:**
- [daftar singkat apa yang masih terasa off]

**Versi final:**
[teks setelah perbaikan audit]
```

Untuk teks pendek di bawah 100 kata, draft dan audit bisa digabung langsung ke versi final jika pass pertama sudah bersih.

---

## Tujuan Akhir

Tulisan harus:

- Natural dan enak dibaca.
- Tidak monoton dan tidak mekanis.
- Relevan dan spesifik terhadap konteks.
- Berbasis fakta yang bisa diverifikasi, bukan kesan atau asumsi.
- Humble tanpa meragukan diri sendiri secara berlebihan.
- Profesional tanpa terasa kaku atau berjarak.
- Bebas dari em dash dan titik koma sebagai jeda dramatis.
- Ditulis seperti oleh manusia yang memahami topik dan jujur soal batas pengetahuannya.
