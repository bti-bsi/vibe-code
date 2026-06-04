import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import fs from 'fs';

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        text: "Sejarah Malaysia",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        text: "Era Prasejarah dan Kerajaan Awal",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun("Wilayah yang kini dikenal sebagai Malaysia telah dihuni sejak zaman prasejarah. Bukti arkeologis menunjukkan keberadaan manusia di Niah Caves, Sarawak, sekitar 40.000 tahun yang lalu. Pada abad pertama Masehi, wilayah Semenanjung Malaya menjadi bagian dari jaringan perdagangan maritim antara India dan Tiongkok. Kerajaan-kerajaan awal seperti Langkasuka, Gangga Negara, dan Kedah Tua berkembang dengan pengaruh Hindu-Buddha yang kuat.")
        ],
        spacing: { after: 2},
      }),
      new Paragraph({
        text: "Kesultanan Melaka (Abad ke-15)",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun("Kesultanan Melaka didirikan sekitar tahun oleh Parameswara, seorang pangeran dari Palembang. Melaka berkembang pesat menjadi pusat perdagangan rempah-rempah dan penyebaran Islam di Asia Tenggara. Di bawah pemerintahan Sultan Mansur Shah dan Sultan Alauddin Riayat Shah, Melaka mencapai puncak kejayaannya. Hukum Kanun Melaka dan Undang-Undang Laut Melaka menjadi dasar sistem hukum dan administrasi maritim yang berpengaruh di seluruh Nusantara.")
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: "Kolonialisme Eropa",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun("Pada tahun 1511, Portugis merebut Melaka, menandai dimulainya era kolonialisme Eropa di wilayah ini. Belanda kemudian mengambil alih pada tahun 1641 melalui perjanjian dengan Johor. Pada abad ke-19, Inggris mulai memperluas pengaruhnya di Semenanjung Malaya melalui Perjanjian Pangkor 1874, yang menempatkan residen Inggris di Perak. Wilayah Sabah dan Sarawak di Kalimantan juga berada di bawah pengaruh Inggris melalui North Borneo Company dan keluarga Brooke secara berturut-turut.")
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: "Pendudukan Jepang dan Kebangkitan Nasionalisme",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun("Jepang menduduki Malaya dari tahun 1942 hingga 1945 selama Perang Dunia II. Pendudukan ini memicu kebangkitan nasionalisme dan gerakan kemerdekaan. Setelah perang, Inggris membentuk Uni Malaya pada tahun 1946, namun ditentang keras oleh masyarakat Melayu karena dianggap mengikis kedaulatan sultan-sultan. Hal ini mendorong pembentukan UMNO (United Malays National Organisation) oleh Dato' Onn Jaafar.")
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: "Kemerdekaan dan Pembentukan Malaysia",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun("Persekutuan Tanah Melayu memperoleh kemerdekaan dari Inggris pada tanggal 31 Agustus 1957, dengan Tunku Abdul Rahman sebagai Perdana Menteri pertama. Pada tanggal 16 September 1963, Malaysia dibentuk melalui penggabungan Persekutuan Tanah Melayu, Singapura, Sabah, dan Sarawak. Namun, Singapura keluar dari federasi pada tahun 1965 akibat perbedaan politik dan ekonomi.")
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: "Malaysia Modern",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun("Sejak kemerdekaan, Malaysia mengalami transformasi ekonomi yang signifikan dari negara agraris menjadi ekonomi industri baru. Kebijakan Ekonomi Baru (NEP) yang diluncurkan pada tahun 1971 bertujuan mengurangi kemiskinan dan merestrukturisasi kesenjangan ekonomi antar etnis. Di bawah kepemimpinan Mahathir Mohamad (1981-2003), Malaysia membangun infrastruktur modern termasuk Menara Kembar Petronas dan Multimedia Super Corridor. Hari ini, Malaysia merupakan salah satu ekonomi terbesar di Asia Tenggara dengan masyarakat multietnis yang beragam.")
        ],
        spacing: { after: 200 },
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('history.docx', buffer);
console.log('File history.docx berhasil dibuat.');
