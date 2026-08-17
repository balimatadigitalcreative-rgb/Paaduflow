import { useEffect, useState } from 'react'

/**
 * Router seadanya, berbasis hash.
 *
 * D-037 memilih TanStack Router, dan itu tetap tujuannya. Yang dipakai di sini
 * sengaja lebih kecil: antarmuka ini dibangun untuk **menilai apakah alurnya
 * benar**, dan menambah satu ketergantungan besar beserta pembangkitan rutenya
 * sebelum ada yang tahu bentuk URL yang benar adalah memutuskan terlalu awal.
 *
 * Hash dipilih daripada History API karena ia tidak menuntut apa pun dari
 * server: `/#/penjualan/faktur/xyz` tidak pernah sampai ke Fastify, sehingga
 * tidak perlu ada rute penangkap-semua yang mengembalikan index.html.
 *
 * Yang belum ada dan akan dibutuhkan saat TanStack Router masuk: keadaan filter
 * daftar di URL, pemuat data per rute, dan tata letak bersarang.
 */

export interface Route {
  readonly path: readonly string[]
  readonly raw: string
}

function bacaHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return { raw, path: raw === '' ? [] : raw.split('/').filter((bagian) => bagian !== '') }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(bacaHash)

  useEffect(() => {
    const dengar = (): void => setRoute(bacaHash())
    window.addEventListener('hashchange', dengar)
    return () => window.removeEventListener('hashchange', dengar)
  }, [])

  return route
}

export function pergiKe(path: string): void {
  window.location.hash = `#/${path.replace(/^\/+/, '')}`
}

/** Href untuk tautan. Dipakai `DataTable`, yang memang menuntut tautan sungguhan. */
export function href(path: string): string {
  return `#/${path.replace(/^\/+/, '')}`
}
