import { useState } from 'react'
import type { ReactNode } from 'react'

import { Badge, StatusBadge, Tag, type DocumentStatus } from './components/badge.js'
import { Button, type ButtonVariant } from './components/button.js'
import { Checkbox, Radio, Switch } from './components/choice.js'
import { CurrencyInput } from './components/currency-input.js'
import { TextArea, TextField } from './components/text-field.js'
import { DOCUMENT_STATUS_LABEL } from './components/badge.js'

/**
 * Galeri komponen.
 *
 * Menampilkan seluruh komponen dengan seluruh state sekaligus, supaya
 * perbedaan antar-state terlihat berdampingan — bukan satu per satu di layar
 * yang berbeda, tempat kesalahan kontras dan pergeseran lebar tidak terlihat.
 */

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger', 'link']

export function Gallery(): ReactNode {
  const [teks, setTeks] = useState('')
  const [catatan, setCatatan] = useState('')
  const [nominal, setNominal] = useState<number | null>(185_000)
  const [dicentang, setDicentang] = useState(false)
  const [sebagian, setSebagian] = useState(true)
  const [aktif, setAktif] = useState(true)
  const [pilihan, setPilihan] = useState('bulanan')

  return (
    <main>
      <h1>Galeri Komponen</h1>

      <section>
        <h2>Button</h2>
        {VARIANTS.map((variant) => (
          <p key={variant}>
            <Button variant={variant}>Simpan</Button>{' '}
            <Button variant={variant} loading>
              Simpan
            </Button>{' '}
            <Button variant={variant} disabled>
              Simpan
            </Button>
          </p>
        ))}
        <p>
          <Button size="sm">Kecil</Button> <Button size="md">Sedang</Button>{' '}
          <Button size="lg">Besar</Button>
        </p>
      </section>

      <section>
        <h2>Text field</h2>
        <TextField
          label="Email"
          value={teks}
          placeholder="nama@perusahaan.com"
          helper="Dipakai untuk mengirim faktur."
          onChange={setTeks}
          data-testid="galeri-email"
        />
        <TextField label="Email" value={teks} error="Format email tidak dikenali." onChange={setTeks} />
        <TextField label="Nomor dokumen" value="INV/2026/08/0142" readOnly onChange={() => undefined} />
        <TextField label="Dibuat oleh" value="Sistem" disabled onChange={() => undefined} />
        <TextArea label="Catatan" value={catatan} maxLength={200} onChange={setCatatan} />
      </section>

      <section>
        <h2>Nominal</h2>
        <CurrencyInput
          label="Total"
          currency="IDR"
          value={nominal}
          helper="Ketik angka mentah; pemisah ribuan muncul saat kursor meninggalkan field."
          onChange={setNominal}
          data-testid="galeri-nominal"
        />
        <CurrencyInput label="Total (USD)" currency="USD" value={nominal} onChange={setNominal} />
      </section>

      <section>
        <h2>Pilihan</h2>
        <Checkbox label="Kirim salinan ke saya" checked={dicentang} onChange={setDicentang} />
        <Checkbox
          label="Pilih semua baris"
          checked={false}
          indeterminate={sebagian}
          onChange={() => setSebagian(!sebagian)}
        />
        <Radio
          name="periode"
          value="bulanan"
          label="Bulanan"
          checked={pilihan === 'bulanan'}
          onChange={setPilihan}
        />
        <Radio
          name="periode"
          value="tahunan"
          label="Tahunan"
          checked={pilihan === 'tahunan'}
          onChange={setPilihan}
        />
        <Switch label="Terima notifikasi email" checked={aktif} onChange={setAktif} />
      </section>

      <section>
        <h2>Badge</h2>
        <p>
          {(Object.keys(DOCUMENT_STATUS_LABEL) as DocumentStatus[]).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </p>
        <p>
          <Badge tone="accent">Aksen</Badge> <Tag>tag bebas</Tag>
        </p>
      </section>
    </main>
  )
}
