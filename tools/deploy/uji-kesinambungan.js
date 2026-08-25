#!/usr/bin/env node
/**
 * Memeriksa apakah layanan pernah putus selama deploy.
 *
 * Menembak beberapa alamat setiap 100ms dan menghitung berapa yang gagal.
 * Sasarannya nol.
 *
 * Yang diukur BUKAN hanya `/healthz`. Endpoint itu kini murni liveness — ia
 * menjawab 200 pada proses yang tidak dapat melayani apa pun, jadi nol
 * kegagalan di sana tidak membuktikan pelanggan tidak terganggu. Karena itu
 * tiga alamat ditembak bersamaan:
 *
 *   /healthz   proses hidup                — lewat Nginx
 *   /readyz    proses siap melayani        — lewat Nginx
 *   /          antarmuka yang dibuka orang — lewat Nginx
 *
 * Seluruhnya lewat Nginx, bukan lewat 127.0.0.1: yang ingin dibuktikan adalah
 * apa yang dilihat pelanggan, dan pelanggan tidak pernah menyentuh porta 3000.
 *
 * Pemakaian:
 *   node tools/deploy/uji-kesinambungan.js https://paaduflow.com 240
 *
 * Argumen kedua adalah lama pemantauan dalam detik. Skrip berhenti sendiri saat
 * waktunya habis, atau saat menerima SIGINT.
 */

const ASAL = process.argv[2] ?? 'https://paaduflow.com'
const DETIK = Number(process.argv[3] ?? 180)
const JEDA_MS = 100

/**
 * Timeout per permintaan.
 *
 * Dua detik, jauh di atas ekor terukur 3,3 detik? Tidak — sengaja DI BAWAHnya.
 * Yang diperiksa di sini adalah ketersediaan, bukan latensi permintaan berat:
 * ketiga alamat ini ringan, dan yang lebih lambat dari dua detik memang berarti
 * ada yang salah. Permintaan berat diuji terpisah.
 */
const BATAS_MS = 2000

const JALUR = ['/healthz', '/readyz', '/']

/** Satu baris ringkasan per jalur. */
const catatan = new Map(
  JALUR.map((jalur) => [
    jalur,
    { total: 0, gagal: 0, kodeGagal: new Map(), terlamaMs: 0, putusPertama: null },
  ]),
)

const mulai = Date.now()

function detikSejakMulai() {
  return ((Date.now() - mulai) / 1000).toFixed(1)
}

async function tembak(jalur) {
  const rekam = catatan.get(jalur)
  const t0 = Date.now()
  const batal = AbortSignal.timeout(BATAS_MS)

  rekam.total += 1
  try {
    const jawaban = await fetch(`${ASAL}${jalur}`, {
      signal: batal,
      // Cache peramban tidak berlaku di sini, tetapi proxy perantara bisa.
      // Tanpa ini, jawaban tersimpan akan menyamarkan putusnya layanan.
      headers: { 'cache-control': 'no-cache' },
    })

    const lama = Date.now() - t0
    if (lama > rekam.terlamaMs) rekam.terlamaMs = lama

    if (!jawaban.ok) {
      rekam.gagal += 1
      const kunci = String(jawaban.status)
      rekam.kodeGagal.set(kunci, (rekam.kodeGagal.get(kunci) ?? 0) + 1)
      if (rekam.putusPertama === null) rekam.putusPertama = detikSejakMulai()
      process.stdout.write(`  ${detikSejakMulai()}s  ${jalur}  ${jawaban.status}\n`)
    }
  } catch (galat) {
    rekam.gagal += 1
    const sebab = galat instanceof Error ? galat.name : 'tidak diketahui'
    rekam.kodeGagal.set(sebab, (rekam.kodeGagal.get(sebab) ?? 0) + 1)
    if (rekam.putusPertama === null) rekam.putusPertama = detikSejakMulai()
    process.stdout.write(`  ${detikSejakMulai()}s  ${jalur}  ${sebab}\n`)
  }
}

function ringkas() {
  const lebar = Math.max(...JALUR.map((j) => j.length))
  let adaGagal = false

  process.stdout.write('\n  HASIL\n\n')
  for (const [jalur, rekam] of catatan) {
    if (rekam.gagal > 0) adaGagal = true
    const rincian =
      rekam.gagal === 0
        ? 'tidak ada'
        : [...rekam.kodeGagal.entries()].map(([k, n]) => `${k}×${n}`).join(' ')

    process.stdout.write(
      `  ${jalur.padEnd(lebar)}  ${String(rekam.total).padStart(5)} permintaan  ` +
        `${String(rekam.gagal).padStart(4)} gagal  ` +
        `terlama ${String(rekam.terlamaMs).padStart(5)}ms  ${rincian}\n`,
    )
  }

  const total = [...catatan.values()].reduce((a, r) => a + r.total, 0)
  const gagal = [...catatan.values()].reduce((a, r) => a + r.gagal, 0)

  process.stdout.write('\n')
  if (adaGagal) {
    const pertama = [...catatan.values()].find((r) => r.putusPertama !== null)?.putusPertama
    process.stdout.write(
      `  ${gagal} dari ${total} permintaan GAGAL. Putus pertama pada detik ${pertama}.\n\n`,
    )
    process.exitCode = 1
  } else {
    process.stdout.write(`  ${total} permintaan, 0 gagal. Layanan tidak pernah putus.\n\n`)
  }
}

process.stdout.write(
  `\n  Memantau ${ASAL} setiap ${JEDA_MS}ms selama ${DETIK} detik.\n` +
    `  Jalur: ${JALUR.join('  ')}\n\n  Kegagalan dicetak saat terjadi:\n\n`,
)

let berhenti = false
process.on('SIGINT', () => {
  berhenti = true
})

const selesaiPada = Date.now() + DETIK * 1000

while (!berhenti && Date.now() < selesaiPada) {
  /*
   * Ketiga jalur ditembak bersamaan, lalu jeda.
   *
   * Bukan berurutan: menembaknya satu per satu membuat jarak antar sampel
   * bergantung pada latensi, sehingga jendela putus yang singkat dapat
   * terlewat justru karena permintaan sebelumnya lambat.
   */
  await Promise.all(JALUR.map((jalur) => tembak(jalur)))
  await new Promise((lanjut) => setTimeout(lanjut, JEDA_MS))
}

ringkas()
