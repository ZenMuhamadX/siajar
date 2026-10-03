/**
 * Pemeriksa keseimbangan schema.sql — bukan pengganti psql, hanya jaring supaya
 * blok yang tidak seimbang ketahuan sebelum dijalankan.
 *
 * Catatan: blok `DO` di berkas ini ditutup dengan `END $$;`, bukan `$$` di baris
 * sendiri — deteksi yang salah soal itu sempat membuat pemeriksa ini melaporkan
 * satu blok raksasa yang sebenarnya sehat.
 */
const teks = await Bun.file('supabase/schema.sql').text();
const D = '$' + '$';

const total = teks.split(D).length - 1;
console.log(`${D} total: ${total} → ${total % 2 === 0 ? 'SEIMBANG' : 'TIDAK SEIMBANG'}\n`);

// `$` harus di-escape: di dalam RegExp ia anchor, bukan karakter harfiah.
const Esc = '\\$\\$';
const pola = new RegExp('DO\\s*' + Esc + '([\\s\\S]*?)' + Esc + ';', 'g');
const blok = [...teks.matchAll(pola)];
console.log(`Blok DO ditemukan: ${blok.length}`);

/** Rentang baris setiap blok DO — dipakai memeriksa aturan DROP COLUMN di bawah. */
const rentangBlok: Array<[number, number]> = blok.map((m) => {
  const awal = teks.slice(0, m.index).split('\n').length;
  const akhir = awal + m[0].split('\n').length - 1;
  return [awal, akhir];
});
const diDalamBlok = (baris: number) =>
  rentangBlok.some(([a, b]) => baris >= a && baris <= b);

let masalah = 0;
blok.forEach((m, i) => {
  const isi = m[1];
  const barisAwal = teks.slice(0, m.index).split('\n').length;

  const begin = (isi.match(/\bBEGIN\b/g) ?? []).length;
  const endSemi = (isi.match(/\bEND;/g) ?? []).length;
  const akhir = (isi.match(/\bEND\s*$/g) ?? []).length;

  // Patokan yang kokoh: setiap `IF … THEN` harus berpasangan dengan `END IF;`.
  // Menghitung kata `IF` saja menyesatkan — ia juga muncul di `END IF;` dan di
  // dalam teks seperti `DROP POLICY IF EXISTS`.
  const then = (isi.match(/\bTHEN\b/g) ?? []).length;
  const endIf = (isi.match(/\bEND IF;/g) ?? []).length;

  const ok = then === endIf && begin === 1 && endSemi + akhir === 1;
  if (!ok) masalah++;
  console.log(
    `  DO #${i + 1} (mulai baris ${barisAwal}): BEGIN=${begin} THEN=${then} END IF=${endIf} penutup=${akhir} → ${ok ? 'OK' : 'PERIKSA'}`,
  );
});

// Fungsi: setiap `CREATE OR REPLACE FUNCTION` harus punya pasangan $$ yang utuh.
const fungsi = [...teks.matchAll(/CREATE OR REPLACE FUNCTION\s+([\w.]+)/g)];
console.log(`\nFungsi ditemukan: ${fungsi.length}`);
for (const f of fungsi) {
  const sisa = teks.slice(f.index!);
  const tutup = sisa.indexOf(D + ';', sisa.indexOf(D) + D.length);
  const barisAwal = teks.slice(0, f.index).split('\n').length;
  const ok = tutup > 0;
  if (!ok) masalah++;
  console.log(`  ${f[1]} (baris ${barisAwal}) → ${ok ? 'OK' : 'TIDAK DITUTUP'}`);
}

// ATURAN: setiap `DROP COLUMN` harus berada di dalam blok DO yang dijaga
// pengecekan keberadaan kolomnya.
//
// Inilah akar bug yang benar-benar terjadi: `UPDATE agenda.schedule SET
// class_id = …` ditulis di luar penjaga, sementara `DROP COLUMN class_id`
// dikerjakan di dalam penjaga di bagian lain. Sekali dijalankan, kolomnya
// hilang; dijalankan lagi, file ini meledak dengan "column s.class_id does not
// exist". Memeriksa letak DROP COLUMN menangkap seluruh keluarga bug itu.
const barisSemua = teks.split('\n');
const dropDiluar: string[] = [];
/** Baris komentar tidak dihitung — komentar memang menyebut nama perintahnya. */
const barisPerintah = (b: string) => !b.trim().startsWith('--');

barisSemua.forEach((b, i) => {
  if (barisPerintah(b) && /\bDROP COLUMN\b/i.test(b) && !diDalamBlok(i + 1)) {
    dropDiluar.push(`baris ${i + 1}: ${b.trim()}`);
  }
});

const jumlahDrop = barisSemua.filter((b) => barisPerintah(b) && /\bDROP COLUMN\b/i.test(b)).length;
console.log(`\nDROP COLUMN ditemukan: ${jumlahDrop}`);
if (dropDiluar.length > 0) {
  masalah += dropDiluar.length;
  console.log('  ❌ ada DROP COLUMN di LUAR blok penjaga:');
  dropDiluar.forEach((d) => console.log(`     ${d}`));
} else {
  console.log('  ✅ semuanya berada di dalam blok DO yang dijaga');
}

console.log(masalah === 0 ? '\n✅ Struktur schema.sql sehat' : `\n❌ ${masalah} masalah`);
