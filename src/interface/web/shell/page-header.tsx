import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'

/**
 * Isi page header yang datang dari halaman.
 *
 * Susunan page header ditetapkan Component_Specs_Composite §7 dan sama di
 * seluruh produk: breadcrumb → judul → badge status → baris konteks → aksi
 * primer → tab. Susunan itu dimiliki shell, dan memang harus begitu — kalau
 * setiap layar menggambarnya sendiri, keseragamannya hilang dalam sebulan.
 *
 * Tetapi dua bagiannya hanya diketahui halaman: status dokumen dan jumlah baris
 * per tab. Halaman adalah anak dari shell, dan anak tidak dapat mengisi prop
 * induknya. Context ini jalur satu-satunya untuk itu — plumbing, bukan
 * komponen. Yang dikirim adalah elemen yang sudah jadi, sehingga shell tidak
 * perlu tahu apa pun tentang bentuk status maupun tab.
 */

export interface IsiHeaderHalaman {
  readonly badges?: ReactNode
  readonly tabs?: ReactNode
}

type Pasang = (isi: IsiHeaderHalaman) => void

const Konteks = createContext<Pasang | null>(null)

export function PenyediaHeaderHalaman({
  pasang,
  children,
}: {
  readonly pasang: Pasang
  readonly children: ReactNode
}): ReactNode {
  return <Konteks.Provider value={pasang}>{children}</Konteks.Provider>
}

/**
 * Mengisi page header dari dalam halaman.
 *
 * `deps` wajib disebut pemanggil, seperti `useEffect`. Isi header dibangun ulang
 * setiap render — membandingkannya sebagai objek akan memasang ulang tanpa
 * henti, dan render tak berujung di layar yang dipakai delapan jam sehari
 * bukan sesuatu yang boleh ditemukan pengguna.
 *
 * Pembersihan mengosongkan header saat halaman ditinggalkan. Tanpa itu, badge
 * "Terposting" dari satu faktur akan menempel di layar berikutnya.
 */
export function useHeaderHalaman(
  bangun: () => IsiHeaderHalaman,
  deps: readonly unknown[],
): void {
  const pasang = useContext(Konteks)

  useEffect(() => {
    pasang?.(bangun())
    return () => pasang?.({})
  }, [pasang, ...deps])
}
