/**
 * Aturan keamanan migrasi — apa yang boleh dijalankan saat kode lama dan kode
 * baru berjalan bersamaan.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   JENDELA YANG DIJAGA BERKAS INI
 *
 *   `pm2 reload` mengganti instance satu per satu. Selama beberapa detik, kode
 *   LAMA dan kode BARU melayani permintaan dari basis data yang SAMA. Migrasi
 *   berjalan sebelum reload, jadi selama jendela itu kode lama berbicara dengan
 *   skema baru.
 *
 *   Kolom yang dihapus di migrasi membuat setiap SELECT kode lama gagal. Kolom
 *   NOT NULL tanpa nilai bawaan membuat setiap INSERT kode lama gagal — dan
 *   INSERT yang gagal di tengah posting faktur adalah dokumen yang hilang.
 *
 *   Karena itu migrasi hanya boleh MENAMBAH. Perubahan yang merusak dipecah
 *   tiga rilis (D-161).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dua kelompok aturan, dua akibat berbeda:
 *
 *   ATURAN_MERUSAK  — merusak kode yang sedang berjalan. Menggagalkan CI.
 *   ATURAN_LAMBAT   — mengunci tabel dan menahan aplikasi. Menolak dijalankan
 *                     sebaris dengan deploy; harus dijalankan di luar jam sibuk.
 */

/**
 * Migrasi 0001–0025 mendahului penjaga ini.
 *
 * Keduanya tidak dapat didamaikan: penjaga checksum melarang mengubah migrasi
 * yang sudah tercatat, dan seluruh dua puluh lima itu sudah diterapkan di
 * produksi. Menuntutnya patuh berarti menuntut sejarah ditulis ulang.
 *
 * Angka ini TIDAK boleh dinaikkan. Menaikkannya berarti membebaskan migrasi
 * baru dari pemeriksaan, yang persis kebalikan dari gunanya berkas ini.
 */
export const AMBANG_PENJAGA = 25

/** `-- paadu:allow-breaking <alasan>` — alasannya wajib, dan wajib bermakna. */
const POLA_IZIN_MERUSAK = /--\s*paadu:allow-breaking\b[ \t]*(.*)$/im

/** `-- paadu:jalankan-manual <alasan>` — menandai migrasi yang berjalan di luar deploy. */
const POLA_JALANKAN_MANUAL = /--\s*paadu:jalankan-manual\b[ \t]*(.*)$/im

/**
 * Panjang minimum alasan.
 *
 * Dua puluh karakter tidak menjamin alasan yang baik, dan tidak bermaksud
 * begitu. Yang dicegah adalah `-- paadu:allow-breaking ok` — penanda yang
 * ditempel agar CI diam, tanpa satu pun kalimat yang dapat dibaca peninjau.
 */
const PANJANG_ALASAN_MINIMUM = 20

// ── Pemecah pernyataan ──────────────────────────────────────────────────────

/**
 * Memecah SQL menjadi pernyataan, sadar komentar dan literal.
 *
 * Ditulis sendiri alih-alih memakai regex `split(';')` karena titik koma muncul
 * di dalam string, di dalam blok `$$ … $$`, dan di dalam komentar. Memecah
 * dengan regex membelah blok `DO $$ … $$` di tengah, dan aturan mana pun yang
 * berjalan di atas potongan itu memeriksa hal yang bukan SQL.
 *
 * Mengembalikan, per pernyataan:
 *   `mentah`   teks apa adanya, komentar ikut
 *   `sql`      komentar dibuang, spasi dirapatkan — yang diperiksa aturan
 *   `komentar` seluruh komentar milik pernyataan itu, termasuk yang mendahuluinya
 *   `baris`    nomor baris pertama pernyataan, untuk pesan galat
 */
export function pecahPernyataan(teks) {
  const pernyataan = []

  let mentah = ''
  let sql = ''
  let komentar = ''
  let baris = 1
  let barisMulai = null

  let i = 0
  const n = teks.length

  const simpan = () => {
    if (mentah.trim() === '') {
      mentah = ''
      sql = ''
      komentar = ''
      return
    }
    pernyataan.push({
      mentah,
      sql: sql.replace(/\s+/g, ' ').trim(),
      komentar,
      baris: barisMulai ?? baris,
    })
    mentah = ''
    sql = ''
    komentar = ''
    barisMulai = null
  }

  while (i < n) {
    const c = teks[i]
    const dua = teks.slice(i, i + 2)

    if (c === '\n') baris += 1

    // Komentar baris
    if (dua === '--') {
      const akhir = teks.indexOf('\n', i)
      const potong = akhir === -1 ? teks.slice(i) : teks.slice(i, akhir)
      mentah += potong
      komentar += `${potong}\n`
      i += potong.length
      continue
    }

    // Komentar blok
    if (dua === '/*') {
      const akhir = teks.indexOf('*/', i + 2)
      const potong = akhir === -1 ? teks.slice(i) : teks.slice(i, akhir + 2)
      mentah += potong
      komentar += `${potong}\n`
      baris += (potong.match(/\n/g) ?? []).length
      i += potong.length
      continue
    }

    // Literal berkutip tunggal, dengan '' sebagai escape
    if (c === "'") {
      let j = i + 1
      while (j < n) {
        if (teks[j] === "'" && teks[j + 1] === "'") {
          j += 2
          continue
        }
        if (teks[j] === "'") break
        j += 1
      }
      const potong = teks.slice(i, Math.min(j + 1, n))
      mentah += potong
      sql += potong
      baris += (potong.match(/\n/g) ?? []).length
      i += potong.length
      continue
    }

    // Blok berkutip dolar: $$ … $$ atau $tag$ … $tag$
    const dolar = /^\$[A-Za-z_]*\$/.exec(teks.slice(i))
    if (dolar !== null) {
      const tanda = dolar[0]
      const akhir = teks.indexOf(tanda, i + tanda.length)
      const potong = akhir === -1 ? teks.slice(i) : teks.slice(i, akhir + tanda.length)
      mentah += potong
      sql += potong
      baris += (potong.match(/\n/g) ?? []).length
      i += potong.length
      continue
    }

    if (c === ';') {
      mentah += c
      simpan()
      i += 1
      continue
    }

    if (barisMulai === null && /\S/.test(c)) barisMulai = baris
    mentah += c
    sql += c
    i += 1
  }

  simpan()
  return pernyataan
}

/**
 * Bagian `-- Down Migration` sengaja memuat RAISE, bukan DDL.
 *
 * Migrasi di repo ini maju saja (D-033); bagian turunnya hanya melempar galat
 * yang menjelaskan hal itu. Memeriksanya berarti mengeluh atas teks yang tidak
 * akan pernah dijalankan.
 */
export function bagianNaik(sql) {
  const tanda = sql.search(/^\s*--\s*Down Migration/im)
  return tanda === -1 ? sql : sql.slice(0, tanda)
}

// ── Pembantu pembacaan pernyataan ───────────────────────────────────────────

/** Memecah isi `ALTER TABLE` menjadi klausa, pada koma tingkat teratas. */
function klausaAlter(sql) {
  const cocok = /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?[\w."]+\s+([\s\S]+)$/i.exec(sql)
  if (cocok === null) return []

  const isi = cocok[1]
  const hasil = []
  let dalam = 0
  let sekarang = ''

  for (const c of isi) {
    if (c === '(') dalam += 1
    else if (c === ')') dalam -= 1

    if (c === ',' && dalam === 0) {
      hasil.push(sekarang.trim())
      sekarang = ''
      continue
    }
    sekarang += c
  }
  if (sekarang.trim() !== '') hasil.push(sekarang.trim())
  return hasil
}

/** Nama tabel yang DIBUAT di migrasi yang sama. */
function tabelBaru(daftarPernyataan) {
  const nama = new Set()
  for (const { sql } of daftarPernyataan) {
    const cocok = /\bCREATE\s+(?:UNLOGGED\s+|TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."]+)/i.exec(
      sql,
    )
    if (cocok !== null) nama.add(cocok[1].replace(/"/g, '').toLowerCase())
  }
  return nama
}

/** Fungsi yang memaksa penulisan ulang tabel bila dipakai sebagai DEFAULT. */
const FUNGSI_VOLATILE =
  /\b(random|gen_random_uuid|uuid_generate_v[145]|clock_timestamp|timeofday|nextval)\s*\(/i

// ── Aturan yang merusak kode berjalan ───────────────────────────────────────

/**
 * Setiap aturan membawa saran, bukan hanya larangan.
 *
 * Penjaga yang mengatakan "tidak boleh" tanpa mengatakan "lakukan ini"
 * mengajari orang mencari cara melewatinya, bukan cara memenuhinya.
 */
export const ATURAN_MERUSAK = [
  {
    kode: 'kolom-dihapus',
    nama: 'DROP COLUMN',
    uji: (p) => /\bDROP\s+COLUMN\b/i.test(p.sql),
    akibat: 'Setiap SELECT kode lama yang menyebut kolom itu gagal seketika.',
    saran: 'Berhenti menulis kolomnya dulu (tahap 3), hapus di rilis BERIKUTNYA.',
  },
  {
    kode: 'tabel-dihapus',
    nama: 'DROP TABLE',
    uji: (p) => /\bDROP\s+TABLE\b/i.test(p.sql),
    akibat: 'Kode lama yang menyentuh tabel itu gagal seketika.',
    saran: 'Hentikan seluruh pemakaiannya lebih dulu, hapus di rilis berikutnya.',
  },
  {
    kode: 'diganti-nama',
    nama: 'RENAME',
    uji: (p) => /\bRENAME\s+(COLUMN\b|TO\b|CONSTRAINT\b)/i.test(p.sql),
    akibat: 'Nama lama hilang seketika; kode lama tidak menemukannya lagi.',
    saran: 'Tambah nama baru, tulis ke keduanya, pindahkan pembacaan, baru buang yang lama.',
  },
  {
    kode: 'tipe-diubah',
    nama: 'ALTER COLUMN … TYPE',
    uji: (p) => /\bALTER\s+COLUMN\s+[\w."]+\s+(?:SET\s+DATA\s+)?TYPE\b/i.test(p.sql),
    akibat:
      'Nilai yang tidak muat dipotong atau ditolak, dan kode lama menulis dengan bentuk lama.',
    saran: 'Tambah kolom baru bertipe baru, tulis ke keduanya, pindahkan pembacaan.',
  },
  {
    kode: 'not-null-dipasang',
    nama: 'SET NOT NULL',
    uji: (p) => /\bALTER\s+COLUMN\s+[\w."]+\s+SET\s+NOT\s+NULL\b/i.test(p.sql),
    akibat: 'INSERT kode lama yang tidak mengisi kolom itu gagal.',
    saran:
      'Isi seluruh baris lama lebih dulu, pastikan kode baru selalu mengisinya, ' +
      'baru pasang NOT NULL di rilis berikutnya.',
  },
  {
    kode: 'kolom-not-null-tanpa-bawaan',
    nama: 'ADD COLUMN … NOT NULL tanpa DEFAULT',
    uji: (p) =>
      klausaAlter(p.sql).some((klausa) => {
        if (!/^ADD\s+(COLUMN\s+)?(IF\s+NOT\s+EXISTS\s+)?/i.test(klausa)) return false
        if (!/\bNOT\s+NULL\b/i.test(klausa)) return false
        // DEFAULT dan GENERATED sama-sama menyediakan nilai untuk baris lama
        // maupun untuk INSERT kode lama yang tidak menyebut kolomnya.
        return !/\bDEFAULT\b/i.test(klausa) && !/\bGENERATED\b/i.test(klausa)
      }),
    akibat:
      'Baris yang sudah ada tidak punya nilai, dan setiap INSERT kode lama yang ' +
      'tidak menyebut kolom ini gagal.',
    saran: 'Beri DEFAULT, atau tambahkan sebagai nullable dan isi di tahap berikutnya.',
  },
  {
    kode: 'batasan-melanggar-baris-lama',
    nama: 'ADD CONSTRAINT yang belum tentu dipenuhi baris lama',
    uji: (p) =>
      klausaAlter(p.sql).some((klausa) => {
        if (!/^ADD\s+(CONSTRAINT\s+[\w."]+\s+)?/i.test(klausa)) return false

        // UNIQUE lewat indeks yang sudah dibangun terpisah adalah jalur AMAN,
        // dan justru jalur yang dianjurkan. Ia tidak memindai apa pun lagi.
        if (/\bUSING\s+INDEX\b/i.test(klausa)) return false

        const memvalidasi = /\b(CHECK|FOREIGN\s+KEY|REFERENCES)\b/i.test(klausa)
        if (memvalidasi) return !/\bNOT\s+VALID\b/i.test(klausa)

        // UNIQUE, PRIMARY KEY, dan EXCLUDE tidak mengenal NOT VALID sama sekali.
        return /\b(UNIQUE|PRIMARY\s+KEY|EXCLUDE)\b/i.test(klausa)
      }),
    akibat:
      'Migrasi gagal bila satu baris lama saja melanggarnya — di tengah deploy, ' +
      'setelah sebagian langkah lain sudah berjalan.',
    saran:
      'Untuk CHECK dan FOREIGN KEY: tambahkan NOT VALID, lalu VALIDATE CONSTRAINT ' +
      'terpisah. Untuk UNIQUE: CREATE UNIQUE INDEX CONCURRENTLY dulu, lalu ADD ' +
      'CONSTRAINT … USING INDEX.',
  },
  {
    kode: 'tabel-dikosongkan',
    nama: 'TRUNCATE',
    uji: (p) => /\bTRUNCATE\b/i.test(p.sql),
    akibat: 'Data hilang, dan tidak ada yang mengembalikannya.',
    saran: 'Bila memang disengaja, tulis alasannya lewat pintu darurat.',
  },
  {
    kode: 'objek-dihapus',
    nama: 'DROP objek',
    uji: (p) => /\bDROP\s+(TYPE|SCHEMA|FUNCTION|POLICY|TRIGGER|INDEX)\b/i.test(p.sql),
    akibat: 'Kode lama yang bergantung pada objek itu berhenti bekerja.',
    saran: 'Hentikan pemakaiannya lebih dulu, hapus di rilis berikutnya.',
  },
]

// ── Aturan yang lambat dan mengunci ─────────────────────────────────────────

export const ATURAN_LAMBAT = [
  {
    kode: 'indeks-mengunci',
    nama: 'CREATE INDEX tanpa CONCURRENTLY',
    uji: (p, konteks) => {
      if (!/\bCREATE\s+(UNIQUE\s+)?INDEX\b/i.test(p.sql)) return false
      if (/\bCONCURRENTLY\b/i.test(p.sql)) return false

      // Indeks atas tabel yang dibuat di migrasi yang sama tidak menahan siapa
      // pun: tabelnya masih kosong dan belum terlihat transaksi lain.
      const atas = /\bON\s+(?:ONLY\s+)?([\w."]+)/i.exec(p.sql)
      if (atas === null) return true
      return !konteks.tabelBaru.has(atas[1].replace(/"/g, '').toLowerCase())
    },
    akibat: 'Menahan seluruh penulisan ke tabel itu selama indeks dibangun.',
    saran: 'CREATE INDEX CONCURRENTLY, di luar transaksi — karena itu di luar deploy.',
  },
  {
    kode: 'tabel-ditulis-ulang',
    nama: 'ALTER COLUMN … TYPE',
    uji: (p) => /\bALTER\s+COLUMN\s+[\w."]+\s+(?:SET\s+DATA\s+)?TYPE\b/i.test(p.sql),
    akibat: 'Menulis ulang seluruh tabel dengan kunci ACCESS EXCLUSIVE.',
    saran: 'Pakai kolom baru dan pindahkan bertahap; jangan ubah tipe di tempat.',
  },
  {
    kode: 'batasan-memindai',
    nama: 'ADD CONSTRAINT tanpa NOT VALID',
    uji: (p) =>
      klausaAlter(p.sql).some(
        (klausa) =>
          /^ADD\s+(CONSTRAINT\s+[\w."]+\s+)?/i.test(klausa) &&
          /\b(CHECK|FOREIGN\s+KEY|REFERENCES)\b/i.test(klausa) &&
          !/\bNOT\s+VALID\b/i.test(klausa),
      ),
    akibat: 'Memindai seluruh tabel dengan kunci ACCESS EXCLUSIVE.',
    saran: 'Tambahkan NOT VALID, lalu VALIDATE CONSTRAINT di luar deploy.',
  },
  {
    kode: 'pengisian-data',
    nama: 'UPDATE atau DELETE atas tabel yang sudah ada',
    uji: (p, konteks) => {
      const cocok = /^\s*(UPDATE|DELETE\s+FROM)\s+(?:ONLY\s+)?([\w."]+)/i.exec(p.sql)
      if (cocok === null) return false
      return !konteks.tabelBaru.has(cocok[2].replace(/"/g, '').toLowerCase())
    },
    akibat: 'Mengunci baris yang disentuhnya selama seluruh migrasi berjalan.',
    saran: 'Isi bertahap dalam potongan kecil, di luar deploy.',
  },
  {
    kode: 'penataan-ulang',
    nama: 'VACUUM FULL, CLUSTER, atau REINDEX',
    uji: (p) =>
      /\bVACUUM\s+FULL\b/i.test(p.sql) ||
      /\bCLUSTER\b/i.test(p.sql) ||
      (/\bREINDEX\b/i.test(p.sql) && !/\bCONCURRENTLY\b/i.test(p.sql)),
    akibat: 'Mengunci tabel sepenuhnya dan menulis ulang seluruh isinya.',
    saran: 'Jalankan terjadwal di luar jam sibuk, bukan sebagai bagian deploy.',
  },
  {
    kode: 'bawaan-volatile',
    nama: 'ADD COLUMN dengan DEFAULT volatile',
    uji: (p) =>
      klausaAlter(p.sql).some(
        (klausa) =>
          /^ADD\s+(COLUMN\s+)?/i.test(klausa) &&
          /\bDEFAULT\b/i.test(klausa) &&
          FUNGSI_VOLATILE.test(klausa),
      ),
    akibat:
      'PostgreSQL 11+ menambah kolom berbawaan TETAP tanpa menyentuh data, tetapi ' +
      'bawaan volatile memaksa seluruh tabel ditulis ulang.',
    saran: 'Tambahkan nullable, isi bertahap, baru pasang bawaannya.',
  },
]

// ── Pintu darurat ───────────────────────────────────────────────────────────

/**
 * Membaca penanda dan alasannya.
 *
 * Alasan yang kosong atau terlalu pendek TIDAK dianggap penanda sah, dan itu
 * dilaporkan sebagai pelanggaran tersendiri — bukan diam-diam diperlakukan
 * seolah penandanya tidak ada. Penanda yang ditolak tanpa penjelasan akan
 * dicoba lagi dengan bentuk yang sama.
 */
export function bacaPenanda(teks, pola) {
  const baris = teks.split(/\r?\n/)
  const indeks = baris.findIndex((satu) => pola.test(satu))
  if (indeks === -1) return { ada: false, alasan: null, cukup: false }

  const potongan = [(pola.exec(baris[indeks])?.[1] ?? '').trim()]

  /*
   * Alasan boleh berlanjut ke baris komentar berikutnya.
   *
   * Sebelumnya hanya baris pertama yang terbaca, dan alasan dua baris muncul
   * terpotong di tengah kalimat saat operator membacanya di layar. Alasan yang
   * hilang separuh lebih buruk daripada tidak ada: ia terbaca seolah lengkap.
   *
   * Berhenti pada baris kosong, pada baris bukan komentar, dan pada penanda
   * `paadu:` berikutnya — supaya dua penanda berdampingan tidak saling menelan.
   */
  for (let i = indeks + 1; i < baris.length; i += 1) {
    const lanjutan = /^\s*--\s?(.*)$/.exec(baris[i])
    if (lanjutan === null) break
    if (/paadu:/i.test(lanjutan[1])) break
    if (lanjutan[1].trim() === '') break
    potongan.push(lanjutan[1].trim())
  }

  const alasan = potongan.join(' ').trim()
  return { ada: true, alasan, cukup: alasan.length >= PANJANG_ALASAN_MINIMUM }
}

// ── Pemeriksaan satu berkas ─────────────────────────────────────────────────

/** Nomor urut dari nama berkas, atau null bila namanya tidak berpola. */
export function nomorMigrasi(nama) {
  const cocok = /^(\d{4})_/.exec(nama)
  return cocok === null ? null : Number(cocok[1])
}

/**
 * Memeriksa isi satu migrasi.
 *
 * Mengembalikan daftar masalah beserta jenisnya, bukan sekadar teks: pemanggil
 * yang berbeda memerlukan hal berbeda — CI menggagalkan build atas `merusak`,
 * sedangkan penjalan migrasi menolak `lambat` yang belum ditandai.
 */
export function periksaIsiMigrasi(nama, isi) {
  const nomor = nomorMigrasi(nama)
  const masalah = []

  // Sejarah tidak dapat diubah, jadi ia tidak diperiksa. Lihat AMBANG_PENJAGA.
  if (nomor !== null && nomor <= AMBANG_PENJAGA) {
    return { masalah: [], lambat: [], manual: { ada: false, alasan: null, cukup: false } }
  }

  const naik = bagianNaik(isi)
  const daftarPernyataan = pecahPernyataan(naik)
  const konteks = { tabelBaru: tabelBaru(daftarPernyataan) }

  const manual = bacaPenanda(naik, POLA_JALANKAN_MANUAL)
  if (manual.ada && !manual.cukup) {
    masalah.push({
      jenis: 'penanda',
      kode: 'alasan-manual-kurang',
      baris: 1,
      pesan:
        `${nama} — penanda paadu:jalankan-manual tanpa alasan yang dapat dibaca ` +
        `(minimal ${PANJANG_ALASAN_MINIMUM} karakter).`,
    })
  }

  const lambat = []

  for (const pernyataan of daftarPernyataan) {
    const izin = bacaPenanda(pernyataan.komentar, POLA_IZIN_MERUSAK)

    for (const aturan of ATURAN_MERUSAK) {
      if (!aturan.uji(pernyataan, konteks)) continue

      if (izin.ada && izin.cukup) continue

      if (izin.ada && !izin.cukup) {
        masalah.push({
          jenis: 'penanda',
          kode: 'alasan-kurang',
          baris: pernyataan.baris,
          pesan:
            `${nama}:${pernyataan.baris} — ${aturan.nama} memakai paadu:allow-breaking ` +
            `tanpa alasan yang dapat dibaca (minimal ${PANJANG_ALASAN_MINIMUM} karakter). ` +
            `Alasan yang ditulis: "${izin.alasan}".`,
        })
        continue
      }

      masalah.push({
        jenis: 'merusak',
        kode: aturan.kode,
        baris: pernyataan.baris,
        pesan:
          `${nama}:${pernyataan.baris} — ${aturan.nama}.\n` +
          `      Akibat : ${aturan.akibat}\n` +
          `      Lakukan: ${aturan.saran}`,
      })
    }

    for (const aturan of ATURAN_LAMBAT) {
      if (!aturan.uji(pernyataan, konteks)) continue
      lambat.push({
        kode: aturan.kode,
        baris: pernyataan.baris,
        pesan:
          `${nama}:${pernyataan.baris} — ${aturan.nama}.\n` +
          `      Akibat : ${aturan.akibat}\n` +
          `      Lakukan: ${aturan.saran}`,
      })
    }
  }

  /*
   * Migrasi lambat yang BELUM ditandai adalah kesalahan; yang SUDAH ditandai
   * bukan. Penandanya tidak membuatnya cepat — ia memindahkan tanggung jawab
   * menjalankannya ke luar deploy, dan itulah yang diminta.
   */
  if (lambat.length > 0 && !manual.ada) {
    for (const satu of lambat) {
      masalah.push({
        jenis: 'lambat',
        kode: satu.kode,
        baris: satu.baris,
        pesan:
          `${satu.pesan}\n` +
          `      Tandai  : -- paadu:jalankan-manual <alasan>  lalu jalankan ` +
          `npm run migrate:manual`,
      })
    }
  }

  return { masalah, lambat, manual }
}
