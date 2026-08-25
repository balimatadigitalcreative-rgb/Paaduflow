import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormEvent, ReactNode } from 'react'

import { api, ApiError } from '../api/client.js'
import { Button } from '../components/button.js'
import { ErrorSummary, type FieldError } from '../components/form/form.js'
import { TextField } from '../components/text-field.js'
import styles from './pages.module.css'

/**
 * Halaman masuk.
 *
 * Satu hal yang perlu diperhatikan: pesan gagal masuk **tidak** membedakan
 * "email tidak terdaftar" dari "kata sandi salah". Server memang menjawab sama
 * untuk keduanya, dan layar tidak boleh memperbaiki apa yang sengaja
 * disamarkan.
 */
export function HalamanMasuk({ onMasuk }: { readonly onMasuk: () => void }): ReactNode {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<readonly FieldError[]>([])
  const [sedang, setSedang] = useState(false)

  async function kirim(event: FormEvent): Promise<void> {
    event.preventDefault()
    setErrors([])
    setSedang(true)

    try {
      await api.masuk(email, password)
      onMasuk()
    } catch (galat) {
      const pesan = galat instanceof ApiError ? galat.message : t('masuk.tidakTerhubung')
      setErrors([{ fieldId: 'masuk-email', label: t('masuk.email'), message: pesan }])
    } finally {
      setSedang(false)
    }
  }

  return (
    <main className={styles.masuk}>
      <h1>{t('masuk.judul')}</h1>
      <p>{t('masuk.ajakan')}</p>

      {errors.length > 0 ? <ErrorSummary errors={errors} /> : null}

      <form
        className={styles.masukForm}
        onSubmit={(event) => {
          void kirim(event)
        }}
        noValidate
      >
        <TextField
          id="masuk-email"
          label={t('masuk.email')}
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <TextField
          id="masuk-sandi"
          label={t('masuk.sandi')}
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <Button type="submit" loading={sedang}>
          {t('masuk.tombol')}
        </Button>
      </form>
    </main>
  )
}
