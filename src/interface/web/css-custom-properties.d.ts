/**
 * Mengizinkan custom property di atribut `style`.
 *
 * React tidak mengenalnya, sedangkan lint arsitektur justru MENUNTUTnya: nilai
 * visual yang baru diketahui saat berjalan masuk lewat custom property, dan
 * cara ia diterjemahkan menjadi ukuran tetap tinggal di CSS Module tempat
 * aturan token berlaku.
 *
 * Tanpa deklarasi ini, satu-satunya jalan adalah cast `as CSSProperties` — dan
 * cast itu membuat lint berhenti mengenali objeknya sebagai literal, sehingga
 * aturan yang sama justru menolaknya.
 */
import 'react'

declare module 'react' {
  interface CSSProperties {
    readonly [kunci: `--${string}`]: string | number | undefined
  }
}
