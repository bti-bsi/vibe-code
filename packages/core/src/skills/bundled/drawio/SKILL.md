---
name: drawio-diagram
description: |
  Generates draw.io XML diagrams for UML (Class, Sequence, Use Case, Activity, State),
  ERD (Entity Relationship Diagram), and Flowcharts.
  Use this skill whenever user asks to create, draw, or generate a diagram, flowchart,
  UML, ERD, architecture diagram, or any visual structure meant to be opened in draw.io.
  Trigger on: "buat diagram", "buatkan flowchart", "UML class diagram", "ERD database",
  "draw.io", "sequence diagram", "state diagram", "activity diagram", "buat use case".
  Output is always a valid .drawio XML file.
argument-hint: '<diagram-type> <description>'
allowedTools:
  - read_file
  - write_file
  - edit
---

# Draw.io Diagram Generator

Skill ini menghasilkan file XML yang valid untuk dibuka di draw.io (app.diagrams.net).
Ikuti panduan ini secara ketat. Setiap bagian memuat snippet XML yang siap dipakai.

---

## ATURAN WAJIB

1. Selalu mulai output dengan wrapper XML berikut. Jangan pernah ubah baris id="0" dan id="1".
2. Setiap elemen (node/shape) harus punya atribut `vertex="1"` dan `parent="1"`.
3. Setiap koneksi (edge/arrow) harus punya atribut `edge="1"` dan `parent="1"`.
4. Setiap node harus punya child tag `<mxGeometry>` dengan posisi x, y dan ukuran width, height.
5. Setiap edge harus punya child tag `<mxGeometry relative="1" as="geometry"/>`.
6. ID dimulai dari angka 2 dan bertambah 1 untuk setiap elemen baru.
7. Source dan target pada edge merujuk ke ID node yang sudah didefinisikan.
8. Selalu sertakan atribut `html="1"` di dalam style string.
9. Simpan output sebagai file dengan ekstensi `.drawio`.

---

## STRUKTUR DASAR WAJIB

Ini adalah kerangka yang SELALU dipakai. Isi konten di antara komentar.

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
  connect="1" arrows="1" fold="1" page="1" pageScale="1"
  pageWidth="1169" pageHeight="827" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <!-- SEMUA NODE DAN EDGE DILETAKKAN DI SINI, SETELAH BARIS INI -->
    <!-- GUNAKAN parent="1" UNTUK SEMUA ELEMEN -->
  </root>
</mxGraphModel>
```

---

## REFERENSI POSISI DAN UKURAN

Gunakan grid 10px. Atur posisi x,y agar elemen tidak bertumpukan.

| Elemen            | Width yang Disarankan | Height yang Disarankan |
| ----------------- | --------------------- | ---------------------- |
| Process/Rectangle | 120                   | 60                     |
| Decision/Diamond  | 80                    | 80                     |
| Start/End Oval    | 120                   | 40                     |
| UML Class         | 160                   | 120 (sesuai konten)    |
| ERD Entity        | 160                   | 60                     |
| ERD Attribute     | 100                   | 40                     |
| ERD Relationship  | 80                    | 80                     |
| Sequence Lifeline | 160                   | 300                    |
| Use Case Ellipse  | 120                   | 60                     |
| Actor (stickman)  | 40                    | 60                     |

Jarak antar elemen minimal 20px horizontal, 30px vertikal.

---

## BAGIAN 1: FLOWCHART

### 1.1 Start / End (Terminal)

```xml
<mxCell id="2" value="Start" style="ellipse;whiteSpace=wrap;html=1;
  fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=12;"
  vertex="1" parent="1">
  <mxGeometry x="460" y="40" width="120" height="40" as="geometry" />
</mxCell>
```

Untuk End, ganti value="Start" dengan value="End" dan ubah x,y posisinya.

### 1.2 Process (Rectangle)

```xml
<mxCell id="3" value="Nama Proses" style="rounded=0;whiteSpace=wrap;html=1;
  fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="420" y="120" width="160" height="60" as="geometry" />
</mxCell>
```

### 1.3 Decision (Diamond / Rhombus)

```xml
<mxCell id="4" value="Kondisi?" style="rhombus;whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="440" y="220" width="120" height="80" as="geometry" />
</mxCell>
```

### 1.4 Input / Output (Parallelogram)

```xml
<mxCell id="5" value="Input Data" style="parallelogram;perimeter=parallelogramPerimeter;
  whiteSpace=wrap;html=1;fixedSize=1;
  fillColor=#f8cecc;strokeColor=#b85450;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="420" y="340" width="160" height="60" as="geometry" />
</mxCell>
```

### 1.5 Sub-Process (Rectangle dengan border ganda)

```xml
<mxCell id="6" value="Sub Proses" style="rounded=0;whiteSpace=wrap;html=1;
  shape=mxgraph.flowchart.subprocess;
  fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="420" y="440" width="160" height="60" as="geometry" />
</mxCell>
```

### 1.6 Document

```xml
<mxCell id="7" value="Dokumen" style="shape=mxgraph.flowchart.document;
  whiteSpace=wrap;html=1;
  fillColor=#ffe6cc;strokeColor=#d79b00;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="420" y="540" width="160" height="60" as="geometry" />
</mxCell>
```

### 1.7 Database / Storage

```xml
<mxCell id="8" value="Database" style="shape=mxgraph.flowchart.database;
  whiteSpace=wrap;html=1;
  fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="420" y="640" width="160" height="60" as="geometry" />
</mxCell>
```

### 1.8 Manual Operation (Trapezoid terbalik)

```xml
<mxCell id="9" value="Manual Input" style="shape=mxgraph.flowchart.manual_operation;
  whiteSpace=wrap;html=1;
  fillColor=#f5f5f5;strokeColor=#666666;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="420" y="740" width="160" height="60" as="geometry" />
</mxCell>
```

### 1.9 Connector / Off-page Reference (Pentagon)

```xml
<mxCell id="10" value="A" style="shape=mxgraph.flowchart.off-page connector;
  whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="460" y="840" width="80" height="60" as="geometry" />
</mxCell>
```

### 1.10 Predefined Process

```xml
<mxCell id="11" value="Fungsi X()" style="shape=mxgraph.flowchart.predefined_process;
  whiteSpace=wrap;html=1;
  fillColor=#d5e8d4;strokeColor=#82b366;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="420" y="940" width="160" height="60" as="geometry" />
</mxCell>
```

### 1.11 Arrow / Edge Flowchart

Arrow biasa (default):

```xml
<mxCell id="12" value="" style="edgeStyle=orthogonalEdgeStyle;html=1;"
  edge="1" source="2" target="3" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Arrow dengan label (Yes/No pada decision):

```xml
<mxCell id="13" value="Yes" style="edgeStyle=orthogonalEdgeStyle;html=1;"
  edge="1" source="4" target="3" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

---

## BAGIAN 2: UML CLASS DIAGRAM

### 2.1 Class (dengan compartment nama, atribut, method)

Gunakan pola swimlane bertingkat. Satu class terdiri dari parent swimlane + 2 child swimlane.

Parent (nama class):

```xml
<mxCell id="20" value="NamaClass" style="swimlane;startSize=30;html=1;
  fillColor=#dae8fc;strokeColor=#6c8ebf;
  fontStyle=1;fontSize=12;align=center;"
  vertex="1" parent="1">
  <mxGeometry x="80" y="80" width="200" height="150" as="geometry" />
</mxCell>
```

Child 1 - Atribut (harus punya parent = ID parent di atas, misal "20"):

```xml
<mxCell id="21" value="- namaAtribut : String&#xa;- umur : int&#xa;+ status : boolean"
  style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;
  spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;
  points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontSize=11;"
  vertex="1" parent="20">
  <mxGeometry y="30" width="200" height="60" as="geometry" />
</mxCell>
```

Child 2 - Method:

```xml
<mxCell id="22" value="+ getNama() : String&#xa;+ setUmur(i: int) : void&#xa;- hitung() : int"
  style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;
  spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;
  points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontSize=11;"
  vertex="1" parent="20">
  <mxGeometry y="90" width="200" height="60" as="geometry" />
</mxCell>
```

Catatan: `&#xa;` adalah newline di dalam value XML draw.io.

### 2.2 Interface (UML)

```xml
<mxCell id="23" value="&lt;&lt;interface&gt;&gt;&#xa;INamaInterface"
  style="swimlane;startSize=30;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;
  fontStyle=3;fontSize=12;align=center;"
  vertex="1" parent="1">
  <mxGeometry x="340" y="80" width="200" height="120" as="geometry" />
</mxCell>
```

Child method interface:

```xml
<mxCell id="24" value="+ method1() : void&#xa;+ method2() : String"
  style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;
  spacingLeft=4;spacingRight=4;overflow=hidden;html=1;fontSize=11;"
  vertex="1" parent="23">
  <mxGeometry y="30" width="200" height="90" as="geometry" />
</mxCell>
```

### 2.3 Abstract Class

Sama seperti class biasa, tapi nama class ditulis miring (italic) dengan fontStyle=2:

```xml
<mxCell id="25" value="AbstractNama" style="swimlane;startSize=30;html=1;
  fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;
  fontStyle=2;fontSize=12;align=center;"
  vertex="1" parent="1">
  <mxGeometry x="600" y="80" width="200" height="150" as="geometry" />
</mxCell>
```

### 2.4 Relasi UML Class

**Association (asosiasi biasa, panah terbuka):**

```xml
<mxCell id="30" value="" style="endArrow=open;endFill=0;html=1;"
  edge="1" source="20" target="23" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

**Inheritance / Generalization (panah segitiga kosong ke parent):**

```xml
<mxCell id="31" value="" style="endArrow=block;endFill=0;html=1;
  edgeStyle=orthogonalEdgeStyle;"
  edge="1" source="20" target="25" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

**Realization / Implements (garis putus ke interface):**

```xml
<mxCell id="32" value="" style="endArrow=block;endFill=0;html=1;
  dashed=1;edgeStyle=orthogonalEdgeStyle;"
  edge="1" source="20" target="23" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

**Dependency (garis putus, panah terbuka):**

```xml
<mxCell id="33" value="&lt;&lt;uses&gt;&gt;" style="endArrow=open;endFill=0;html=1;
  dashed=1;edgeStyle=orthogonalEdgeStyle;"
  edge="1" source="20" target="23" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

**Aggregation (diamond kosong di sisi whole):**

```xml
<mxCell id="34" value="" style="endArrow=open;endFill=0;html=1;
  startArrow=ERmany;startFill=0;endArrow=none;
  exitX=1;exitY=0.5;entryX=0;entryY=0.5;
  startArrow=diamondThin;startFill=0;html=1;"
  edge="1" source="20" target="23" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Cara lebih sederhana untuk Aggregation:

```xml
<mxCell id="34" value="" style="shape=mxgraph.uml.aggregation;html=1;
  endArrow=none;startArrow=none;"
  edge="1" source="20" target="23" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

**Composition (diamond isi di sisi whole):**

```xml
<mxCell id="35" value="" style="startArrow=diamondThin;startFill=1;endArrow=open;
  endFill=0;html=1;edgeStyle=orthogonalEdgeStyle;"
  edge="1" source="20" target="23" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

**Multiplicity label pada edge:**
Tambahkan mxPoint sebagai waypoint dan gunakan value untuk label di edge.

Untuk Association dengan multiplicity, gunakan dua label terpisah:

```xml
<mxCell id="36" value="1" style="resizable=0;html=1;align=left;
  verticalAlign=bottom;labelBackgroundColor=none;"
  connectable="0" vertex="1" parent="35">
  <mxGeometry x="-1" relative="1" as="geometry">
    <mxPoint as="offset" />
  </mxGeometry>
</mxCell>

<mxCell id="37" value="*" style="resizable=0;html=1;align=right;
  verticalAlign=bottom;labelBackgroundColor=none;"
  connectable="0" vertex="1" parent="35">
  <mxGeometry x="1" relative="1" as="geometry">
    <mxPoint as="offset" />
  </mxGeometry>
</mxCell>
```

---

## BAGIAN 3: UML SEQUENCE DIAGRAM

### 3.1 Lifeline (garis vertikal objek/aktor)

```xml
<mxCell id="40" value="NamaObjek" style="shape=mxgraph.uml.lifeline;
  whiteSpace=wrap;html=1;
  fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;fontStyle=1;"
  vertex="1" parent="1">
  <mxGeometry x="100" y="40" width="160" height="300" as="geometry" />
</mxCell>
```

### 3.2 Activation Bar (kotak tipis di atas lifeline, menunjukkan eksekusi)

```xml
<mxCell id="41" value="" style="shape=mxgraph.uml.activation;
  html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
  vertex="1" parent="1">
  <mxGeometry x="172" y="120" width="16" height="60" as="geometry" />
</mxCell>
```

### 3.3 Message (panah antar lifeline)

Synchronous message (panah solid, kepala solid):

```xml
<mxCell id="42" value="namaMethod(param)" style="html=1;
  endArrow=block;endFill=1;edgeStyle=orthogonalEdgeStyle;fontSize=11;"
  edge="1" source="40" target="50" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Return message (panah putus):

```xml
<mxCell id="43" value="return hasil" style="html=1;
  endArrow=open;endFill=0;dashed=1;edgeStyle=orthogonalEdgeStyle;fontSize=11;"
  edge="1" source="50" target="40" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Asynchronous message (panah terbuka):

```xml
<mxCell id="44" value="asyncCall()" style="html=1;
  endArrow=open;endFill=0;edgeStyle=orthogonalEdgeStyle;fontSize=11;"
  edge="1" source="40" target="50" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Self-message (panah kembali ke diri sendiri):

```xml
<mxCell id="45" value="selfMethod()" style="html=1;
  endArrow=block;endFill=1;edgeStyle=elbowEdgeStyle;elbow=vertical;fontSize=11;"
  edge="1" source="40" target="40" parent="1">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="310" y="150" />
      <mxPoint x="310" y="180" />
    </Array>
  </mxGeometry>
</mxCell>
```

### 3.4 Combined Fragment (loop, alt, opt, ref)

Frame untuk fragment:

```xml
<mxCell id="46" value="loop [condition]" style="swimlane;startSize=20;html=1;
  align=left;spacingLeft=5;fillColor=none;strokeColor=#666666;
  dashed=0;fontSize=11;fontStyle=1;"
  vertex="1" parent="1">
  <mxGeometry x="80" y="200" width="400" height="100" as="geometry" />
</mxCell>
```

Alt fragment (gunakan horizontal separator di dalam swimlane):

```xml
<mxCell id="47" value="alt" style="swimlane;startSize=20;html=1;
  align=left;spacingLeft=5;fillColor=none;strokeColor=#666666;fontSize=11;fontStyle=1;"
  vertex="1" parent="1">
  <mxGeometry x="80" y="340" width="400" height="160" as="geometry" />
</mxCell>

<mxCell id="48" value="[condition true]" style="text;html=1;align=left;
  fontSize=10;fontStyle=2;fillColor=none;strokeColor=none;"
  vertex="1" parent="47">
  <mxGeometry x="5" y="22" width="150" height="20" as="geometry" />
</mxCell>

<mxCell id="49" value="" style="endArrow=none;dashed=1;html=1;"
  edge="1" parent="47">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="0" y="80" />
      <mxPoint x="400" y="80" />
    </Array>
  </mxGeometry>
</mxCell>
```

---

## BAGIAN 4: UML USE CASE DIAGRAM

### 4.1 Actor (stickman)

```xml
<mxCell id="60" value="NamaAktor" style="shape=mxgraph.uml.actor;
  whiteSpace=wrap;html=1;
  fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="60" y="200" width="40" height="60" as="geometry" />
</mxCell>
```

### 4.2 Use Case (ellipse)

```xml
<mxCell id="61" value="Nama Use Case" style="ellipse;whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="200" y="200" width="140" height="60" as="geometry" />
</mxCell>
```

### 4.3 System Boundary (rectangle dengan label)

```xml
<mxCell id="62" value="Nama Sistem" style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],
  [1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
  shape=mxgraph.uml.systemBoundary;align=left;verticalAlign=bottom;
  spacingLeft=6;strokeColor=#666666;fillColor=none;fontSize=14;fontStyle=1;"
  vertex="1" parent="1">
  <mxGeometry x="160" y="100" width="320" height="300" as="geometry" />
</mxCell>
```

### 4.4 Relasi Use Case

Association (aktor ke use case):

```xml
<mxCell id="63" value="" style="endArrow=none;html=1;"
  edge="1" source="60" target="61" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Include:

```xml
<mxCell id="64" value="&lt;&lt;include&gt;&gt;" style="endArrow=open;endFill=0;
  html=1;dashed=1;fontSize=10;"
  edge="1" source="61" target="65" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Extend:

```xml
<mxCell id="65" value="&lt;&lt;extend&gt;&gt;" style="endArrow=open;endFill=0;
  html=1;dashed=1;fontSize=10;"
  edge="1" source="66" target="61" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Generalization (inheritance antar use case atau antar actor):

```xml
<mxCell id="66" value="" style="endArrow=block;endFill=0;html=1;"
  edge="1" source="60" target="67" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

---

## BAGIAN 5: UML ACTIVITY DIAGRAM

### 5.1 Initial Node (lingkaran hitam solid)

```xml
<mxCell id="70" value="" style="ellipse;html=1;shape=doubleEllipse;
  whiteSpace=wrap;aspect=fixed;fillColor=#000000;strokeColor=#ffffff;
  fontSize=28;fontColor=#ffffff;fontStyle=1;"
  vertex="1" parent="1">
  <mxGeometry x="480" y="40" width="30" height="30" as="geometry" />
</mxCell>
```

### 5.2 Final Node (lingkaran hitam dengan ring)

```xml
<mxCell id="71" value="" style="ellipse;html=1;shape=doubleEllipse;
  whiteSpace=wrap;aspect=fixed;fillColor=#000000;strokeColor=#000000;"
  vertex="1" parent="1">
  <mxGeometry x="480" y="700" width="30" height="30" as="geometry" />
</mxCell>
```

### 5.3 Action / Activity (rounded rectangle)

```xml
<mxCell id="72" value="Nama Aktivitas" style="rounded=1;whiteSpace=wrap;html=1;
  arcSize=50;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="400" y="120" width="160" height="50" as="geometry" />
</mxCell>
```

### 5.4 Decision Node (diamond)

```xml
<mxCell id="73" value="" style="rhombus;whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;"
  vertex="1" parent="1">
  <mxGeometry x="455" y="220" width="50" height="50" as="geometry" />
</mxCell>
```

### 5.5 Fork / Join (synchronization bar, kotak hitam panjang horizontal)

```xml
<mxCell id="74" value="" style="shape=mxgraph.uml.fork;html=1;
  fillColor=#000000;strokeColor=#000000;"
  vertex="1" parent="1">
  <mxGeometry x="360" y="320" width="240" height="8" as="geometry" />
</mxCell>
```

### 5.6 Swimlane / Partition

```xml
<mxCell id="75" value="Nama Partisi" style="shape=pool;html=1;
  childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=1;
  resizeParent=1;resizeParentMax=0;resizeLast=1;collapsible=0;marginBottom=0;
  fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=12;"
  vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="700" height="400" as="geometry" />
</mxCell>

<mxCell id="76" value="Lane 1" style="swimlane;html=1;startSize=30;
  fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;fontSize=11;"
  vertex="1" parent="75">
  <mxGeometry x="0" y="0" width="350" height="400" as="geometry" />
</mxCell>

<mxCell id="77" value="Lane 2" style="swimlane;html=1;startSize=30;
  fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;fontSize=11;"
  vertex="1" parent="75">
  <mxGeometry x="350" y="0" width="350" height="400" as="geometry" />
</mxCell>
```

---

## BAGIAN 6: UML STATE DIAGRAM

### 6.1 Initial Pseudostate

```xml
<mxCell id="80" value="" style="ellipse;html=1;aspect=fixed;
  fillColor=#000000;strokeColor=#000000;"
  vertex="1" parent="1">
  <mxGeometry x="230" y="40" width="30" height="30" as="geometry" />
</mxCell>
```

### 6.2 State (rounded rectangle)

```xml
<mxCell id="81" value="Nama State" style="rounded=1;whiteSpace=wrap;html=1;
  arcSize=30;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="160" y="120" width="160" height="50" as="geometry" />
</mxCell>
```

State dengan internal behavior (entry/do/exit):

```xml
<mxCell id="82" value="Nama State" style="swimlane;startSize=30;html=1;
  fillColor=#d5e8d4;strokeColor=#82b366;fontSize=12;fontStyle=1;"
  vertex="1" parent="1">
  <mxGeometry x="160" y="200" width="180" height="100" as="geometry" />
</mxCell>

<mxCell id="83" value="entry / initAction()&#xa;do / runAction()&#xa;exit / cleanUp()"
  style="text;html=1;align=left;verticalAlign=top;
  spacingLeft=4;fontSize=10;fillColor=none;strokeColor=none;"
  vertex="1" parent="82">
  <mxGeometry y="30" width="180" height="70" as="geometry" />
</mxCell>
```

### 6.3 Final State

```xml
<mxCell id="84" value="" style="ellipse;html=1;aspect=fixed;
  shape=doubleEllipse;fillColor=#000000;strokeColor=#000000;"
  vertex="1" parent="1">
  <mxGeometry x="230" y="500" width="30" height="30" as="geometry" />
</mxCell>
```

### 6.4 Transition (edge dengan label event [guard] / action)

```xml
<mxCell id="85" value="event [guard] / action" style="endArrow=block;endFill=1;
  html=1;edgeStyle=orthogonalEdgeStyle;fontSize=10;"
  edge="1" source="81" target="82" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

---

## BAGIAN 7: ERD (ENTITY RELATIONSHIP DIAGRAM)

Draw.io mendukung dua gaya ERD: style klasik (shape geometri) dan style tabel. Gunakan style tabel untuk kejelasan.

### 7.1 Entity (gaya klasik, rectangle)

```xml
<mxCell id="90" value="NamaEntity" style="rounded=0;whiteSpace=wrap;html=1;
  fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=12;"
  vertex="1" parent="1">
  <mxGeometry x="200" y="200" width="160" height="60" as="geometry" />
</mxCell>
```

### 7.2 Weak Entity (double border)

```xml
<mxCell id="91" value="WeakEntity" style="shape=mxgraph.erd.weak_entity;
  whiteSpace=wrap;html=1;
  fillColor=#f8cecc;strokeColor=#b85450;fontStyle=1;fontSize=12;"
  vertex="1" parent="1">
  <mxGeometry x="460" y="200" width="160" height="60" as="geometry" />
</mxCell>
```

### 7.3 Attribute (ellipse)

```xml
<mxCell id="92" value="namaAtribut" style="ellipse;whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;"
  vertex="1" parent="1">
  <mxGeometry x="100" y="300" width="100" height="40" as="geometry" />
</mxCell>
```

### 7.4 Key Attribute (ellipse dengan garis bawah pada teks)

```xml
<mxCell id="93" value="&lt;u&gt;primaryKey&lt;/u&gt;" style="ellipse;whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;"
  vertex="1" parent="1">
  <mxGeometry x="240" y="300" width="100" height="40" as="geometry" />
</mxCell>
```

### 7.5 Derived Attribute (ellipse dengan garis putus)

```xml
<mxCell id="94" value="derivedAttr" style="ellipse;whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;dashed=1;fontSize=10;"
  vertex="1" parent="1">
  <mxGeometry x="380" y="300" width="100" height="40" as="geometry" />
</mxCell>
```

### 7.6 Multi-valued Attribute (double ellipse)

```xml
<mxCell id="95" value="multiAttr" style="shape=doubleEllipse;whiteSpace=wrap;html=1;
  fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;"
  vertex="1" parent="1">
  <mxGeometry x="500" y="300" width="100" height="40" as="geometry" />
</mxCell>
```

### 7.7 Relationship (diamond)

```xml
<mxCell id="96" value="NAMA_RELASI" style="rhombus;whiteSpace=wrap;html=1;
  fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="320" y="180" width="120" height="80" as="geometry" />
</mxCell>
```

### 7.8 Weak Relationship (double diamond)

```xml
<mxCell id="97" value="WEAK_REL" style="shape=mxgraph.erd.weak_relationship;
  whiteSpace=wrap;html=1;
  fillColor=#f8cecc;strokeColor=#b85450;fontStyle=1;fontSize=11;"
  vertex="1" parent="1">
  <mxGeometry x="560" y="180" width="120" height="80" as="geometry" />
</mxCell>
```

### 7.9 ERD Gaya Tabel (direkomendasikan untuk database design)

Header tabel:

```xml
<mxCell id="100" value="nama_tabel" style="swimlane;startSize=30;html=1;
  fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=13;align=center;"
  vertex="1" parent="1">
  <mxGeometry x="80" y="80" width="220" height="200" as="geometry" />
</mxCell>
```

Row kolom (child dari header):

```xml
<mxCell id="101" value="PK | id | INT" style="text;strokeColor=#6c8ebf;html=1;
  fillColor=#dae8fc;align=left;verticalAlign=middle;
  spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;fontSize=11;
  points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
  vertex="1" parent="100">
  <mxGeometry y="30" width="220" height="30" as="geometry" />
</mxCell>

<mxCell id="102" value="FK | user_id | INT" style="text;strokeColor=#d6b656;html=1;
  fillColor=#fff2cc;align=left;verticalAlign=middle;
  spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;fontSize=11;
  points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
  vertex="1" parent="100">
  <mxGeometry y="60" width="220" height="30" as="geometry" />
</mxCell>

<mxCell id="103" value="   | nama | VARCHAR(100)" style="text;strokeColor=#66666680;html=1;
  fillColor=none;align=left;verticalAlign=middle;
  spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;fontSize=11;
  points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
  vertex="1" parent="100">
  <mxGeometry y="90" width="220" height="30" as="geometry" />
</mxCell>
```

### 7.10 Kardinalitas ERD (Crow's Foot Notation)

One-to-Many (1 ke banyak):

```xml
<mxCell id="110" value="" style="endArrow=ERmany;startArrow=ERone;html=1;
  exitX=1;exitY=0.5;entryX=0;entryY=0.5;"
  edge="1" source="100" target="120" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

One-to-One (1 ke 1):

```xml
<mxCell id="111" value="" style="endArrow=ERone;startArrow=ERone;html=1;"
  edge="1" source="100" target="120" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Many-to-Many (banyak ke banyak):

```xml
<mxCell id="112" value="" style="endArrow=ERmany;startArrow=ERmany;html=1;"
  edge="1" source="100" target="120" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Zero-or-One (opsional satu):

```xml
<mxCell id="113" value="" style="endArrow=ERzeroToOne;startArrow=ERone;html=1;"
  edge="1" source="100" target="120" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Zero-or-Many (opsional banyak):

```xml
<mxCell id="114" value="" style="endArrow=ERzeroToMany;startArrow=ERone;html=1;"
  edge="1" source="100" target="120" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

Nilai yang valid untuk startArrow dan endArrow di ERD:

- `ERone` : satu (garis tegak lurus satu)
- `ERmany` : banyak (crow's foot)
- `ERzeroToOne` : nol atau satu
- `ERzeroToMany` : nol atau banyak
- `ERmandOne` : wajib satu (double tegak lurus)
- `ERmandMany` : wajib banyak (crow's foot + tegak lurus)

---

## BAGIAN 8: REFERENSI LENGKAP STYLE ATTRIBUTE

Ini adalah semua atribut style yang dapat dipakai dalam value dari atribut `style="..."`.

### 8.1 Atribut Dasar

| Atribut      | Nilai                | Keterangan                                      |
| ------------ | -------------------- | ----------------------------------------------- |
| `html`       | `0` atau `1`         | Aktifkan HTML di dalam label. Selalu pakai `1`. |
| `whiteSpace` | `wrap` atau `nowrap` | Izinkan teks wrap. Gunakan `wrap`.              |
| `rounded`    | `0` atau `1`         | Sudut kotak melengkung                          |
| `arcSize`    | `0` sampai `100`     | Ukuran lengkungan (dalam %)                     |
| `ellipse`    | (tidak perlu nilai)  | Bentuk ellipse/oval                             |
| `rhombus`    | (tidak perlu nilai)  | Bentuk diamond                                  |
| `triangle`   | (tidak perlu nilai)  | Bentuk segitiga                                 |
| `aspect`     | `fixed`              | Pertahankan rasio saat resize                   |

### 8.2 Warna

| Atribut             | Contoh Nilai                  | Keterangan                 |
| ------------------- | ----------------------------- | -------------------------- |
| `fillColor`         | `#dae8fc`                     | Warna latar shape          |
| `strokeColor`       | `#6c8ebf`                     | Warna garis border         |
| `fontColor`         | `#333333`                     | Warna teks                 |
| `gradientColor`     | `#ffffff`                     | Warna kedua untuk gradient |
| `gradientDirection` | `north` `south` `east` `west` | Arah gradient              |

### 8.3 Font dan Teks

| Atribut                 | Nilai                   | Keterangan                                                          |
| ----------------------- | ----------------------- | ------------------------------------------------------------------- |
| `fontSize`              | angka (contoh: `12`)    | Ukuran font dalam pt                                                |
| `fontStyle`             | `0` `1` `2` `4`         | 0=normal, 1=bold, 2=italic, 4=underline. Gabungkan: `3`=bold+italic |
| `align`                 | `left` `center` `right` | Perataan horizontal                                                 |
| `verticalAlign`         | `top` `middle` `bottom` | Perataan vertikal                                                   |
| `labelPosition`         | `left` `center` `right` | Posisi label relatif terhadap shape                                 |
| `verticalLabelPosition` | `top` `middle` `bottom` | Posisi label vertikal                                               |
| `spacingLeft`           | angka                   | Padding kiri teks                                                   |
| `spacingRight`          | angka                   | Padding kanan teks                                                  |
| `spacingTop`            | angka                   | Padding atas teks                                                   |
| `spacingBottom`         | angka                   | Padding bawah teks                                                  |
| `overflow`              | `hidden` `visible`      | Teks melebihi batas shape                                           |

### 8.4 Border dan Garis

| Atribut       | Nilai               | Keterangan                       |
| ------------- | ------------------- | -------------------------------- |
| `strokeWidth` | angka (contoh: `2`) | Ketebalan garis border           |
| `dashed`      | `0` atau `1`        | Garis putus-putus                |
| `dashPattern` | `8 4` (contoh)      | Pola putus-putus (px on, px off) |
| `opacity`     | `0` sampai `100`    | Transparansi shape               |
| `shadow`      | `0` atau `1`        | Aktifkan bayangan                |

### 8.5 Edge / Connector Style

| Atribut           | Nilai                                                                                                           | Keterangan                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `edgeStyle`       | `none` `orthogonalEdgeStyle` `elbowEdgeStyle` `entityRelationEdgeStyle` `isometricEdgeStyle` `segmentEdgeStyle` | Gaya jalur koneksi                    |
| `endArrow`        | lihat tabel endArrow di bawah                                                                                   | Kepala panah di ujung                 |
| `startArrow`      | lihat tabel endArrow di bawah                                                                                   | Kepala panah di awal                  |
| `endFill`         | `0` atau `1`                                                                                                    | Kepala panah diisi (solid) atau tidak |
| `startFill`       | `0` atau `1`                                                                                                    | Kepala panah awal diisi atau tidak    |
| `curved`          | `0` atau `1`                                                                                                    | Garis melengkung                      |
| `rounded`         | `0` atau `1`                                                                                                    | Sudut belok melengkung                |
| `orthogonal`      | `0` atau `1`                                                                                                    | Paksa sudut tegak lurus               |
| `exitX` `exitY`   | `0` sampai `1`                                                                                                  | Titik keluar dari source              |
| `entryX` `entryY` | `0` sampai `1`                                                                                                  | Titik masuk ke target                 |

### 8.6 Nilai endArrow / startArrow yang Valid

| Nilai          | Bentuk                               |
| -------------- | ------------------------------------ |
| `none`         | Tidak ada kepala panah               |
| `open`         | Panah terbuka (>)                    |
| `block`        | Segitiga (filled bergantung endFill) |
| `classic`      | Panah klasik                         |
| `oval`         | Lingkaran                            |
| `diamond`      | Diamond besar                        |
| `diamondThin`  | Diamond tipis                        |
| `box`          | Kotak                                |
| `halfCircle`   | Setengah lingkaran                   |
| `dash`         | Garis pendek                         |
| `cross`        | Silang                               |
| `ERone`        | ER notation: satu                    |
| `ERmany`       | ER notation: banyak                  |
| `ERzeroToOne`  | ER notation: nol-atau-satu           |
| `ERzeroToMany` | ER notation: nol-atau-banyak         |
| `ERmandOne`    | ER notation: wajib satu              |
| `ERmandMany`   | ER notation: wajib banyak            |

---

## BAGIAN 9: SISTEM WARNA LENGKAP

### 9.1 Prinsip Dasar Pemberian Warna

Aturan ini wajib diikuti sebelum menetapkan warna pada elemen apapun:

1. Warna memiliki MAKNA SEMANTIK, bukan hanya dekorasi. Setiap warna mewakili peran atau status elemen.
2. Satu diagram harus menggunakan SATU TEMA WARNA yang konsisten dari awal sampai akhir.
3. strokeColor harus selalu lebih gelap dari fillColor pada elemen yang sama.
4. fontColor harus selalu kontras dengan fillColor. Jika fillColor gelap, gunakan fontColor=#ffffff. Jika fillColor terang, gunakan fontColor=#333333 atau #000000.
5. Elemen dengan peran yang sama harus mendapat warna yang sama. Jangan variasikan warna untuk node sejenis.
6. Maksimal 5 warna berbeda dalam satu diagram. Lebih dari 5 warna membuat diagram sulit dibaca.
7. Background shape (swimlane, system boundary, frame) harus menggunakan warna yang lebih pucat atau transparan dibandingkan node di dalamnya.

### 9.2 Tabel Palet Warna Semantik

Setiap warna memiliki ARTI dan penggunaan yang ketat:

| Kode Warna | fillColor | strokeColor | fontColor | Makna Semantik                                |
| ---------- | --------- | ----------- | --------- | --------------------------------------------- |
| BIRU       | `#dae8fc` | `#6c8ebf`   | `#333333` | Proses utama, class, entity, aksi normal      |
| HIJAU      | `#d5e8d4` | `#82b366`   | `#333333` | Start, sukses, konfirmasi, state aktif        |
| KUNING     | `#fff2cc` | `#d6b656`   | `#333333` | Decision, kondisi, atribut, perlu perhatian   |
| MERAH      | `#f8cecc` | `#b85450`   | `#333333` | End, error, gagal, peringatan, weak entity    |
| ABU        | `#f5f5f5` | `#666666`   | `#333333` | Background, lane, container, elemen netral    |
| UNGU       | `#e1d5e7` | `#9673a6`   | `#333333` | Interface, abstract, catatan, stereotype      |
| ORANGE     | `#ffe6cc` | `#d79b00`   | `#333333` | Dokumen, output, hasil proses                 |
| BIRU TUA   | `#1e4d78` | `#1e4d78`   | `#ffffff` | Header tabel, judul swimlane penting          |
| HIJAU TUA  | `#1a5c2a` | `#1a5c2a`   | `#ffffff` | Header konfirmasi penting                     |
| MERAH TUA  | `#6d1f1f` | `#6d1f1f`   | `#ffffff` | Header error atau section kritis              |
| TRANSPARAN | `none`    | `#666666`   | `#333333` | System boundary, frame diagram, swimlane luar |

### 9.3 Aturan Warna Per Tipe Diagram

#### Flowchart

| Elemen           | fillColor | strokeColor | fontColor |
| ---------------- | --------- | ----------- | --------- |
| Start            | `#d5e8d4` | `#82b366`   | `#333333` |
| End              | `#f8cecc` | `#b85450`   | `#333333` |
| Process          | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Decision         | `#fff2cc` | `#d6b656`   | `#333333` |
| Input/Output     | `#f8cecc` | `#b85450`   | `#333333` |
| Sub-Process      | `#f5f5f5` | `#666666`   | `#333333` |
| Database         | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Document         | `#ffe6cc` | `#d79b00`   | `#333333` |
| Manual Operation | `#e1d5e7` | `#9673a6`   | `#333333` |

#### UML Class Diagram

| Elemen              | fillColor | strokeColor | fontColor |
| ------------------- | --------- | ----------- | --------- |
| Class biasa         | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Abstract class      | `#f5f5f5` | `#666666`   | `#333333` |
| Interface           | `#e1d5e7` | `#9673a6`   | `#333333` |
| Enum                | `#fff2cc` | `#d6b656`   | `#333333` |
| Compartment atribut | `#ffffff` | `#6c8ebf`   | `#333333` |
| Compartment method  | `#f8f8ff` | `#6c8ebf`   | `#333333` |

#### UML Sequence Diagram

| Elemen            | fillColor | strokeColor | fontColor |
| ----------------- | --------- | ----------- | --------- |
| Lifeline actor    | `#fff2cc` | `#d6b656`   | `#333333` |
| Lifeline sistem   | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Lifeline database | `#f5f5f5` | `#666666`   | `#333333` |
| Activation bar    | `#6c8ebf` | `#6c8ebf`   | `#ffffff` |
| Fragment frame    | `none`    | `#666666`   | `#333333` |

#### UML Use Case Diagram

| Elemen          | fillColor | strokeColor | fontColor |
| --------------- | --------- | ----------- | --------- |
| Actor           | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Use Case        | `#fff2cc` | `#d6b656`   | `#333333` |
| System Boundary | `none`    | `#666666`   | `#333333` |

#### ERD Tabel

| Elemen            | fillColor | strokeColor | fontColor |
| ----------------- | --------- | ----------- | --------- |
| Header tabel      | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Baris PK          | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Baris FK          | `#fff2cc` | `#d6b656`   | `#333333` |
| Baris kolom biasa | `none`    | `#66666680` | `#333333` |

#### UML Activity Diagram

| Elemen          | fillColor | strokeColor | fontColor |
| --------------- | --------- | ----------- | --------- |
| Initial node    | `#000000` | `#000000`   | `#ffffff` |
| Final node      | `#000000` | `#000000`   | `#ffffff` |
| Action          | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Decision        | `#fff2cc` | `#d6b656`   | `#333333` |
| Fork/Join bar   | `#000000` | `#000000`   | `#ffffff` |
| Swimlane header | `#dae8fc` | `#6c8ebf`   | `#333333` |
| Swimlane body   | `#f5f5f5` | `#666666`   | `#333333` |

#### UML State Diagram

| Elemen        | fillColor | strokeColor | fontColor |
| ------------- | --------- | ----------- | --------- |
| Initial state | `#000000` | `#000000`   | `#ffffff` |
| Final state   | `#000000` | `#000000`   | `#ffffff` |
| State normal  | `#d5e8d4` | `#82b366`   | `#333333` |
| State error   | `#f8cecc` | `#b85450`   | `#333333` |

### 9.4 Aturan Warna untuk Konektor / Edge

| Jenis Edge               | strokeColor | fontColor label |
| ------------------------ | ----------- | --------------- |
| Edge biasa (flow normal) | `#666666`   | `#333333`       |
| Edge sukses / Yes        | `#82b366`   | `#82b366`       |
| Edge gagal / No / Error  | `#b85450`   | `#b85450`       |
| Edge dependency (UML)    | `#9673a6`   | `#9673a6`       |
| Edge inheritance (UML)   | `#6c8ebf`   | `#6c8ebf`       |
| Edge relasi ERD          | `#666666`   | `#333333`       |
| Edge sequence message    | `#333333`   | `#333333`       |

Cara menambahkan warna pada edge:

```xml
style="edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#82b366;fontColor=#82b366;"
```

### 9.5 Aturan Kontras Warna (WAJIB DIIKUTI)

Sebelum menetapkan warna, LLM harus memastikan:

- fillColor terang (hex nilai R+G+B > 380): gunakan fontColor=#333333 atau #000000.
- fillColor gelap (hex nilai R+G+B < 200): gunakan fontColor=#ffffff.
- strokeColor harus memiliki nilai lightness yang lebih rendah (lebih gelap) sekitar 30-40% dibanding fillColor.
- Jangan pernah pakai fillColor=#ffffff dengan strokeColor=#ffffff karena tidak terlihat.
- Jangan pernah pakai fillColor=none dengan fontColor=#ffffff karena tidak terbaca.

Daftar kombinasi yang DILARANG:

| fillColor | strokeColor | Alasan Dilarang                     |
| --------- | ----------- | ----------------------------------- |
| `#ffffff` | `#ffffff`   | Border tidak terlihat               |
| `#f5f5f5` | `#f5f5f5`   | Border tidak terlihat               |
| `none`    | `none`      | Shape tidak terlihat sama sekali    |
| `#ff0000` | `#ff0000`   | Terlalu mencolok, tidak profesional |
| `#0000ff` | `#0000ff`   | Terlalu mencolok, tidak profesional |
| `#ffff00` | `#ffff00`   | Border tidak terlihat di background |

### 9.6 Aturan Konsistensi Warna dalam Satu Diagram

Jika sebuah diagram memiliki beberapa elemen dari tipe yang sama (misal 5 class dalam class diagram), SEMUA elemen tipe itu harus memiliki fillColor dan strokeColor yang IDENTIK. Tidak boleh satu class biru dan class lain kuning hanya karena posisinya berbeda.

Pengecualian yang diizinkan:

- Class biasa vs abstract class boleh berbeda warna (karena beda tipe).
- Swimlane header boleh lebih gelap dari swimlane body (karena hierarki visual).
- Header tabel ERD boleh beda warna dari baris isinya (karena beda fungsi).

---

## BAGIAN 10: SISTEM PENEMPATAN POSISI DAN ANTI-TUMPANG TINDIH

### 10.1 Konsep Dasar Sistem Grid

Draw.io menggunakan grid 10px. Semua koordinat x,y,width,height harus merupakan kelipatan 10.

Ukuran kanvas default: pageWidth=1169, pageHeight=827 (A4 landscape).

Margin aman dari tepi kanvas: minimal 40px dari semua sisi. Jangan letakkan elemen di x < 40 atau y < 40.

### 10.2 Definisi Bounding Box dan Zona Aman

Setiap node memiliki BOUNDING BOX yaitu area persegi yang mencakup node tersebut, didefinisikan sebagai:

```
bounding_box = {
  left   = x
  top    = y
  right  = x + width
  bottom = y + height
}
```

Dua node TUMPANG TINDIH jika semua kondisi berikut terpenuhi bersamaan:

```
node_A.right  > node_B.left   (A melewati sisi kiri B)
node_A.left   < node_B.right  (A belum melewati sisi kanan B)
node_A.bottom > node_B.top    (A melewati sisi atas B)
node_A.top    < node_B.bottom (A belum melewati sisi bawah B)
```

ZONA AMAN adalah area bounding box ditambah MARGIN MINIMUM:

- Margin horizontal antar node: 40px
- Margin vertikal antar node: 30px
- Margin lebih besar jika ada konektor yang melewati area tersebut: 60px

### 10.3 Aturan Perhitungan Posisi (Algoritma Wajib)

LLM WAJIB mengikuti langkah ini sebelum menulis koordinat x,y:

**Langkah 1: Hitung total elemen.**
Hitung berapa node yang akan dibuat. Ini menentukan berapa baris dan kolom yang dibutuhkan.

**Langkah 2: Tentukan lebar dan tinggi tiap node.**
Gunakan tabel ukuran di Bagian REFERENSI POSISI DAN UKURAN. Tambahkan margin 40px horizontal dan 30px vertikal.

**Langkah 3: Hitung step horizontal (jarak pusat ke pusat).**

```
step_x = width_node + gap_horizontal
gap_horizontal = 60  (minimal, tambahkan jika ada edge yang kompleks)
```

**Langkah 4: Hitung step vertikal.**

```
step_y = height_node + gap_vertikal
gap_vertikal = 50  (minimal, tambahkan jika ada edge dengan label)
```

**Langkah 5: Tetapkan koordinat awal (origin).**
Origin berbeda per tipe diagram, lihat sub-bagian di bawah.

**Langkah 6: Hitung koordinat setiap elemen.**

```
node[baris][kolom].x = origin_x + (kolom * step_x)
node[baris][kolom].y = origin_y + (baris * step_y)
```

**Langkah 7: Verifikasi tidak ada tumpang tindih.**
Untuk setiap pasang node, hitung bounding box dan pastikan zona aman tidak bersilangan.

**Langkah 8: Periksa batas kanvas.**
Pastikan tidak ada node yang melampaui pageWidth=1169 atau pageHeight=827.
Jika melampaui, ubah layout dari satu kolom menjadi beberapa kolom atau perbesar kanvas dengan mengubah pageWidth dan pageHeight di mxGraphModel.

### 10.4 Tabel Koordinat Presisi per Tipe Diagram

#### Flowchart: Top-to-Bottom Layout

Jalur utama berada di kolom tengah. Cabang berada di kolom kiri atau kanan.

Titik awal origin: x=500, y=40 (tengah halaman A4).

| Elemen ke-N       | x (tengah) | y              | Catatan                      |
| ----------------- | ---------- | -------------- | ---------------------------- |
| Start (N=1)       | 480        | 40             | Width=120, center di x=540   |
| Proses 1          | 460        | 120            | Width=160, y = 40+40+40      |
| Decision 1        | 470        | 220            | Width=120, y = 120+60+40     |
| Proses 2 (Yes)    | 460        | 340            | Width=160, y = 220+80+40     |
| Proses N (Yes)    | 460        | 340+(N-2)\*110 | Step vertikal=110 per proses |
| Cabang No (kiri)  | 260        | y decision     | x = x_tengah - 220           |
| Cabang No (kanan) | 680        | y decision     | x = x_tengah + 220           |
| End               | 480        | y_last + 110   | Width=120                    |

Aturan cabang decision:

- Label "Yes" selalu ke bawah (lanjut jalur utama).
- Label "No" selalu ke samping (kiri atau kanan). Pilih sisi yang lebih sedikit elemennya.
- Cabang No yang kembali ke atas (loop) harus menggunakan waypoint. Letakkan cabang di sisi kanan, route kembali ke atas melalui sisi kanan.

Contoh perhitungan untuk 3 proses + 2 decision:

```
Start:     x=480, y=40,  w=120, h=40
Proses1:   x=460, y=120, w=160, h=60
Decision1: x=470, y=220, w=120, h=80
Proses2:   x=460, y=340, w=160, h=60
Decision2: x=470, y=440, w=120, h=80
Proses3:   x=460, y=560, w=160, h=60
End:       x=480, y=660, w=120, h=40

CabangNo1: x=660, y=220, w=160, h=60  (sisi kanan)
CabangNo2: x=660, y=440, w=160, h=60  (sisi kanan)
```

#### UML Class Diagram: Grid Layout

Origin: x=80, y=80.
Step horizontal: width_class + 60 = 160 + 60 = 220 per kolom.
Step vertikal: height_class + 60. Height class = 30(header) + (jumlah_atribut _ 20) + (jumlah_method _ 20).

Aturan baris:

- Parent class (superclass) ditempatkan di BARIS ATAS.
- Child class (subclass) ditempatkan di BARIS BAWAH, langsung di bawah parent-nya.
- Interface ditempatkan di baris yang SAMA dengan atau di atas class yang mengimplementasikannya.

Penempatan per jumlah class:

```
2 class:  [A]---[B]               satu baris
3 class:  [A]---[B]---[C]         satu baris
4 class:  [A]---[B]               baris 1
          [C]---[D]               baris 2, y += height_max + 80
5-6 class:[A]---[B]---[C]         baris 1
          [D]---[E]---[F]         baris 2
```

Contoh koordinat untuk 4 class (width=160, step_x=220, height=150, step_y=230):

```
ClassA: x=80,  y=80
ClassB: x=300, y=80
ClassC: x=80,  y=310
ClassD: x=300, y=310
```

Jika ada inheritance (A -> B artinya B mewarisi A):

- Letakkan parent di baris atas, child di baris bawah.
- Parent dan child harus di kolom yang sama atau dekat agar edge inheritance pendek.

```
ClassParent:  x=300, y=80
ClassChildA:  x=80,  y=310
ClassChildB:  x=300, y=310
ClassChildC:  x=520, y=310
```

#### UML Sequence Diagram: Lifeline Layout

Origin lifeline pertama: x=80, y=40.
Step antar lifeline: width_lifeline + 60 = 160 + 60 = 220.
Tinggi lifeline harus cukup untuk semua message: height = 80 + (jumlah_message \* 70).

Koordinat message (edge antara lifeline):

- Message pertama: y = 120 (titik tengah y dari activation di lifeline pertama).
- Setiap message berikutnya: y += 70.
- Edge harus horizontal (exitY=0.5, entryY=0.5).
- Jangan pernah buat dua message di y yang sama jika mereka berbeda lifeline.

Contoh untuk 3 lifeline, 5 message:

```
Lifeline1: x=80,  y=40, w=160, h=430
Lifeline2: x=300, y=40, w=160, h=430
Lifeline3: x=520, y=40, w=160, h=430

Activation bar lifeline1: x=152, y=110, w=16, h=300
Activation bar lifeline2: x=372, y=150, w=16, h=200

Message1 (L1->L2): y=130  (center dari activation)
Message2 (L2->L3): y=200
Message3 (L3->L2): y=270  (return)
Message4 (L2->L1): y=340  (return)
Message5 (L1->L1): self-loop, gunakan waypoint di x=280
```

#### ERD Tabel: Grid Layout

Hitung tinggi tiap tabel dulu:

```
height_tabel = 30 (header) + (jumlah_kolom * 30)
```

Origin: x=80, y=80.
Step horizontal: width_tabel + 80 = 220 + 80 = 300.
Step vertikal: height_max_baris + 60.

Aturan penempatan:

- Tabel yang memiliki FK ke tabel lain harus diletakkan BERDEKATAN (selisih x tidak lebih dari 1 step).
- Tabel junction (many-to-many) ditempatkan di ANTARA dua tabel yang dihubungkan.

Contoh 3 tabel (users, orders, products) dengan orders sebagai junction:

```
users:    x=80,  y=80,  w=220, h=150
orders:   x=380, y=80,  w=220, h=210   (di tengah)
products: x=680, y=80,  w=220, h=150
```

Jika tabel lebih dari 4, buat dua baris:

```
Baris 1: tabel 1, 2, 3   (y=80)
Baris 2: tabel 4, 5, 6   (y=80 + height_max_baris1 + 80)
```

#### UML Use Case Diagram

System Boundary adalah container utama. Tentukan ukurannya SETELAH semua use case diperhitungkan.

Origin actor pertama: x=40, y=200.
Origin use case pertama (dalam boundary): x=250, y=120.

Langkah menghitung posisi:

```
1. Hitung jumlah use case (N).
2. Susun use case dalam boundary secara vertikal.
   step_y_usecase = 80
   usecase[i].y = 120 + (i * 80)
3. Hitung tinggi boundary = 40 + (N * 80)
4. Tentukan x boundary = 200
5. Tentukan width boundary = 300 (atau lebih jika label panjang)
6. Letakkan actor di x=40, y=boundary_center_y
7. Jika ada multiple actor, step antar actor: y += 90
```

Contoh 4 use case, 2 actor:

```
SystemBoundary: x=200, y=60,  w=300, h=380
UseCase1:       x=240, y=120, w=140, h=60
UseCase2:       x=240, y=200, w=140, h=60
UseCase3:       x=240, y=280, w=140, h=60
UseCase4:       x=240, y=360, w=140, h=60

Actor1: x=40,  y=160, w=40, h=60  (level usecase 1-2)
Actor2: x=40,  y=300, w=40, h=60  (level usecase 3-4)
```

### 10.5 Aturan Khusus Anti-Tumpang Tindih Node

**Aturan A: Node tidak boleh menyentuh node lain.**
Jarak minimum antar tepi node: 40px horizontal, 30px vertikal.
Rumus cek: jika `node_A.right + 40 > node_B.left` DAN `node_A.bottom + 30 > node_B.top`, maka tumpang tindih. Pindahkan salah satu.

**Aturan B: Child node tidak boleh keluar dari parent-nya.**
Semua child node (misal compartment class UML, baris tabel ERD) harus berada sepenuhnya di dalam bounding box parent.
Rumus cek: child.x >= 0, child.y >= parent.startSize, child.x+child.width <= parent.width, child.y+child.height <= parent.height.

**Aturan C: Node tidak boleh diletakkan di atas konektor yang sering dilalui.**
Jika dua node terhubung oleh edge, pastikan tidak ada node ketiga yang posisinya di jalur tengah antara keduanya. Jika terpaksa, gunakan waypoint untuk membelokkan edge.

**Aturan D: Swimlane atau container tidak boleh bertumpukan.**
Dua swimlane atau system boundary tidak boleh overlap. Margin minimum antar container: 60px.

**Aturan E: Label node harus muat di dalam shape.**
Jika label panjang (lebih dari 20 karakter), tambahkan tinggi node minimal 20px per baris tambahan. Estimasi: setiap 15 karakter = 1 baris, setiap baris = 20px tinggi.

Contoh penyesuaian untuk label panjang:

```
Label "Input Username dan Password" = 30 karakter = 2 baris
height minimum = 60 (standar) + 20 (baris tambahan) = 80
```

### 10.6 Aturan Routing Konektor Anti-Tumpang Tindih

Konektor (edge) yang melewati node lain akan membuat diagram tidak terbaca. Ikuti aturan ini:

**Aturan 1: Gunakan edgeStyle=orthogonalEdgeStyle untuk semua edge.**
Ini memastikan edge berbelok tegak lurus dan lebih mudah di-route.

**Aturan 2: Tentukan exitX, exitY, entryX, entryY secara eksplisit.**
Jangan biarkan draw.io memilih sendiri karena hasilnya tidak konsisten.

Panduan pemilihan exit/entry point:

| Arah koneksi                      | exitX | exitY | entryX | entryY |
| --------------------------------- | ----- | ----- | ------ | ------ |
| Kiri ke kanan                     | 1     | 0.5   | 0      | 0.5    |
| Kanan ke kiri                     | 0     | 0.5   | 1      | 0.5    |
| Atas ke bawah                     | 0.5   | 1     | 0.5    | 0      |
| Bawah ke atas                     | 0.5   | 0     | 0.5    | 1      |
| Diagonal atas-kiri ke bawah-kanan | 1     | 0.5   | 0      | 0.5    |
| Source ke kanan, target ke bawah  | 1     | 0.5   | 0.5    | 0      |
| Source ke bawah, target ke kiri   | 0.5   | 1     | 1      | 0.5    |

**Aturan 3: Gunakan waypoint untuk edge yang melewati node.**
Jika edge harus melewati area yang sudah ada node, tambahkan `<Array as="points">` dengan koordinat titik belok.

Format waypoint:

```xml
<mxCell id="..." edge="1" source="A" target="B" parent="1">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="TITIK_BELOK_X_1" y="TITIK_BELOK_Y_1" />
      <mxPoint x="TITIK_BELOK_X_2" y="TITIK_BELOK_Y_2" />
    </Array>
  </mxGeometry>
</mxCell>
```

Cara menentukan titik belok:

- Bawa edge ke area kosong yang tidak ada node.
- Biasanya letakkan titik belok di luar bounding box semua node yang ada di jalurnya.

Contoh: edge dari Node A (x=80, y=80) ke Node C (x=80, y=400) yang harus menghindari Node B (x=80, y=240):

```xml
<!-- Route edge ke kanan dulu, baru turun, baru kembali ke kiri -->
<Array as="points">
  <mxPoint x="320" y="110" />   <!-- ke kanan dari A -->
  <mxPoint x="320" y="430" />   <!-- turun melewati B di sisi kanan -->
</Array>
```

**Aturan 4: Edge paralel antara dua node yang sama.**
Jika dua node memiliki lebih dari satu edge di antara keduanya (misalnya association + dependency), geser exitY dan entryY agar tidak bertumpukan:

```
Edge pertama:  exitY=0.3, entryY=0.3
Edge kedua:    exitY=0.7, entryY=0.7
```

**Aturan 5: Edge dari decision node.**
Decision node (diamond) memiliki 4 titik exit:

- Atas: exitX=0.5, exitY=0
- Bawah: exitX=0.5, exitY=1
- Kiri: exitX=0, exitY=0.5
- Kanan: exitX=1, exitY=0.5

Satu edge TIDAK BOLEH keluar dari titik yang sama dengan edge lain. Jika ada 3 edge dari decision, gunakan tiga titik exit berbeda.

**Aturan 6: Edge label tidak boleh menimpa node.**
Jika edge memiliki label (misal "Yes", "No", "1..\*"), label tersebut ditempatkan di posisi relatif pada edge. Pastikan jalur edge cukup jauh dari node sehingga label edge tidak jatuh di atas node lain.

### 10.7 Aturan Penyesuaian Ukuran Kanvas

Jika total lebar semua elemen melebihi 1169px atau tinggi melebihi 827px:

1. Hitung total_width = jumlah_kolom _ step_x + 2 _ margin (margin=80).
2. Hitung total_height = jumlah_baris _ step_y + 2 _ margin.
3. Jika total_width > 1169, ubah pageWidth di mxGraphModel menjadi total_width yang dibulatkan ke atas kelipatan 100.
4. Jika total_height > 827, ubah pageHeight di mxGraphModel menjadi total_height yang dibulatkan ke atas kelipatan 100.

Contoh:

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
  connect="1" arrows="1" fold="1" page="1" pageScale="1"
  pageWidth="1600" pageHeight="1200" math="0" shadow="0">
```

### 10.8 Checklist Anti-Tumpang Tindih

Sebelum output XML, verifikasi setiap poin ini:

1. Apakah ada dua node dengan bounding box yang overlap? Hitung secara eksplisit.
2. Apakah semua child node berada di dalam bounding box parent-nya?
3. Apakah semua koordinat x,y merupakan kelipatan 10?
4. Apakah semua elemen berada dalam batas kanvas (x >= 40, y >= 40, x+width <= pageWidth-40, y+height <= pageHeight-40)?
5. Apakah semua edge menggunakan edgeStyle=orthogonalEdgeStyle?
6. Apakah semua edge memiliki exitX, exitY, entryX, entryY yang eksplisit dan tidak konflik?
7. Apakah edge dari decision node keluar dari titik yang berbeda?
8. Apakah ada edge yang jalurnya melewati node lain? Jika ada, tambahkan waypoint.
9. Apakah edge paralel antara dua node yang sama sudah digeser posisi exit/entry-nya?
10. Apakah label teks pada setiap node cukup pendek untuk muat dalam width dan height yang ditetapkan?

---

## BAGIAN 11: KARAKTER KHUSUS DALAM VALUE XML

Beberapa karakter wajib di-escape di dalam atribut XML `value=""`:

| Karakter | Escape                |
| -------- | --------------------- |
| `<`      | `&lt;`                |
| `>`      | `&gt;`                |
| `&`      | `&amp;`               |
| `"`      | `&quot;`              |
| Newline  | `&#xa;`               |
| `«` `»`  | `&lt;&lt;` `&gt;&gt;` |

Contoh penggunaan stereotype interface:

```
value="&lt;&lt;interface&gt;&gt;&#xa;INamaInterface"
```

---

## BAGIAN 12: CONTOH DIAGRAM LENGKAP

### 12.1 Contoh Flowchart Login Sederhana

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
  connect="1" arrows="1" fold="1" page="1" pageScale="1"
  pageWidth="1169" pageHeight="827" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />

    <mxCell id="2" value="Start" style="ellipse;whiteSpace=wrap;html=1;
      fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=12;"
      vertex="1" parent="1">
      <mxGeometry x="460" y="40" width="120" height="40" as="geometry" />
    </mxCell>

    <mxCell id="3" value="Input Username &amp; Password" style="rounded=0;whiteSpace=wrap;html=1;
      fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;"
      vertex="1" parent="1">
      <mxGeometry x="420" y="120" width="200" height="60" as="geometry" />
    </mxCell>

    <mxCell id="4" value="Valid?" style="rhombus;whiteSpace=wrap;html=1;
      fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;"
      vertex="1" parent="1">
      <mxGeometry x="450" y="220" width="140" height="80" as="geometry" />
    </mxCell>

    <mxCell id="5" value="Tampilkan Dashboard" style="rounded=0;whiteSpace=wrap;html=1;
      fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;"
      vertex="1" parent="1">
      <mxGeometry x="420" y="340" width="200" height="60" as="geometry" />
    </mxCell>

    <mxCell id="6" value="Tampilkan Pesan Error" style="rounded=0;whiteSpace=wrap;html=1;
      fillColor=#f8cecc;strokeColor=#b85450;fontSize=11;"
      vertex="1" parent="1">
      <mxGeometry x="680" y="240" width="160" height="60" as="geometry" />
    </mxCell>

    <mxCell id="7" value="End" style="ellipse;whiteSpace=wrap;html=1;
      fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=12;"
      vertex="1" parent="1">
      <mxGeometry x="460" y="440" width="120" height="40" as="geometry" />
    </mxCell>

    <mxCell id="8" value="" style="edgeStyle=orthogonalEdgeStyle;html=1;"
      edge="1" source="2" target="3" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <mxCell id="9" value="" style="edgeStyle=orthogonalEdgeStyle;html=1;"
      edge="1" source="3" target="4" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <mxCell id="10" value="Ya" style="edgeStyle=orthogonalEdgeStyle;html=1;"
      edge="1" source="4" target="5" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <mxCell id="11" value="Tidak" style="edgeStyle=orthogonalEdgeStyle;html=1;"
      edge="1" source="4" target="6" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <mxCell id="12" value="" style="edgeStyle=orthogonalEdgeStyle;html=1;"
      edge="1" source="5" target="7" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <mxCell id="13" value="" style="edgeStyle=orthogonalEdgeStyle;html=1;"
      edge="1" source="6" target="3" parent="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="800" y="270" />
          <mxPoint x="800" y="90" />
          <mxPoint x="520" y="90" />
        </Array>
      </mxGeometry>
    </mxCell>

  </root>
</mxGraphModel>
```

### 12.2 Contoh ERD Tabel (2 tabel dengan relasi)

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
  connect="1" arrows="1" fold="1" page="1" pageScale="1"
  pageWidth="1169" pageHeight="827" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />

    <mxCell id="2" value="users" style="swimlane;startSize=30;html=1;
      fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=13;align=center;"
      vertex="1" parent="1">
      <mxGeometry x="80" y="80" width="220" height="150" as="geometry" />
    </mxCell>

    <mxCell id="3" value="PK | id | INT" style="text;strokeColor=#6c8ebf;html=1;
      fillColor=#dae8fc;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="2">
      <mxGeometry y="30" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="4" value="   | username | VARCHAR(50)" style="text;strokeColor=#66666680;html=1;
      fillColor=none;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="2">
      <mxGeometry y="60" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="5" value="   | email | VARCHAR(100)" style="text;strokeColor=#66666680;html=1;
      fillColor=none;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="2">
      <mxGeometry y="90" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="6" value="   | created_at | DATETIME" style="text;strokeColor=#66666680;html=1;
      fillColor=none;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="2">
      <mxGeometry y="120" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="10" value="orders" style="swimlane;startSize=30;html=1;
      fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=13;align=center;"
      vertex="1" parent="1">
      <mxGeometry x="400" y="80" width="220" height="180" as="geometry" />
    </mxCell>

    <mxCell id="11" value="PK | id | INT" style="text;strokeColor=#6c8ebf;html=1;
      fillColor=#dae8fc;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="10">
      <mxGeometry y="30" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="12" value="FK | user_id | INT" style="text;strokeColor=#d6b656;html=1;
      fillColor=#fff2cc;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="10">
      <mxGeometry y="60" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="13" value="   | total | DECIMAL(10,2)" style="text;strokeColor=#66666680;html=1;
      fillColor=none;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="10">
      <mxGeometry y="90" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="14" value="   | status | ENUM" style="text;strokeColor=#66666680;html=1;
      fillColor=none;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="10">
      <mxGeometry y="120" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="15" value="   | order_date | DATETIME" style="text;strokeColor=#66666680;html=1;
      fillColor=none;align=left;verticalAlign=middle;
      spacingLeft=4;overflow=hidden;fontSize=11;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
      vertex="1" parent="10">
      <mxGeometry y="150" width="220" height="30" as="geometry" />
    </mxCell>

    <mxCell id="20" value="" style="endArrow=ERmany;startArrow=ERmandOne;html=1;
      exitX=1;exitY=0.5;entryX=0;entryY=0.5;edgeStyle=orthogonalEdgeStyle;"
      edge="1" source="2" target="10" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

  </root>
</mxGraphModel>
```

---

## BAGIAN 13: CHECKLIST VALIDASI SEBELUM OUTPUT

Sebelum mengeluarkan XML final, periksa satu per satu:

1. Apakah wrapper `<mxGraphModel>` sudah ada dan benar?
2. Apakah `<mxCell id="0" />` dan `<mxCell id="1" parent="0" />` ada di dalam `<root>`?
3. Apakah semua node punya `vertex="1"` dan `parent="1"`?
4. Apakah semua edge punya `edge="1"`, `source="..."`, `target="..."`, dan `parent="1"`?
5. Apakah semua ID unik dan tidak ada yang duplikat?
6. Apakah semua `source` dan `target` pada edge merujuk ke ID yang benar-benar ada?
7. Apakah child node (misal atribut class UML) punya `parent` yang merujuk ke ID parent-nya, bukan ke "1"?
8. Apakah setiap node punya `<mxGeometry>` dengan x, y, width, height?
9. Apakah setiap edge punya `<mxGeometry relative="1" as="geometry" />`?
10. Apakah karakter `<`, `>`, `&` sudah di-escape di dalam value?
11. Apakah style string mengandung `html=1`?
12. Apakah tidak ada elemen yang saling bertumpukan (periksa x,y dan width,height)?

---

## BAGIAN 14: CARA MENYIMPAN DAN MEMBUKA FILE

Output skill ini selalu disimpan sebagai file dengan ekstensi `.drawio`.

Cara membuka:

1. Buka app.diagrams.net di browser.
2. Klik File > Open from > Device.
3. Pilih file `.drawio` yang sudah disimpan.
4. Atau drag-and-drop file ke jendela draw.io.

Alternatif: Salin seluruh isi XML, lalu di draw.io klik Extras > Edit Diagram, paste konten XML, klik OK.
