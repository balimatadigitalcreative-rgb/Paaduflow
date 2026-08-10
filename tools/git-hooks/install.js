/**
 * Mengarahkan Git ke `.githooks/`, dijalankan otomatis lewat `npm run prepare`.
 *
 * Hook yang harus dipasang manual adalah hook yang tidak terpasang. Ini
 * membuatnya ikut dengan `npm install`, tanpa menambah dependensi.
 *
 * Kegagalan di sini tidak menggagalkan instalasi — mengunduh repo sebagai zip
 * atau memasang dependensi di dalam image build adalah keadaan sah yang tidak
 * punya direktori git untuk dikonfigurasi.
 */

import { execFileSync } from 'node:child_process'

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'pipe' })
  console.log('Hook Git aktif: .githooks')
} catch {
  console.log('Lewati pemasangan hook Git — bukan direktori kerja git.')
}
