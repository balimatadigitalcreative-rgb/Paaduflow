import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '../button.js'
import { Checkbox } from '../choice.js'
import {
  applySort,
  describeSelection,
  isPageFullySelected,
  isPagePartiallySelected,
  isRowSelected,
  NOTHING,
  selectAllMatching,
  selectionCount,
  sortDirectionOf,
  togglePage,
  toggleRow,
} from './selection.js'
import styles from './table.module.css'
import type { BulkAction, Column, FilterState, Selection, SortEntry, TableState } from './types.js'

/**
 * Data table — komponen terpenting di seluruh produk.
 *
 * Yang dijaga di sini, dan alasannya:
 *
 * - Checkbox header hanya memilih halaman ini. Memilih seluruh hasil melewati
 *   afordans terpisah yang menyebutkan jumlahnya.
 * - Aksi massal menerima `Selection`, bukan daftar id — untuk mode `query`,
 *   daftar id memang tidak ada di dalam tipenya.
 * - Konfirmasi menyebut jumlah **dan** nama company. Lapis 4 indikator konteks.
 * - Sort ada di dalam `<button>`; baris dibuka lewat tautan pada kolom
 *   identifier. Tidak ada `onClick` di `<th>` maupun di `<tr>` sebagai
 *   satu-satunya jalan.
 */

export interface DataTableProps<T> {
  readonly caption: string
  readonly columns: readonly Column<T>[]
  readonly state: TableState<T>
  readonly rowId: (row: T) => string
  readonly rowHref: (row: T) => string
  readonly filter: FilterState
  readonly activeFilterLabels?: readonly string[]
  readonly sort: readonly SortEntry[]
  readonly density?: 'comfortable' | 'compact'
  readonly bulkActions?: readonly BulkAction[]
  /** Disebut di dialog konfirmasi aksi massal — lapis 4 indikator konteks. */
  readonly companyName: string
  readonly emptyAction?: ReactNode
  onSortChange(sort: readonly SortEntry[]): void
  onRetry?(): void
  onClearFilters?(): void
  onNextPage?(cursor: string): void
}

const SKELETON_ROWS = 8

export function DataTable<T>(props: DataTableProps<T>): ReactNode {
  const [selection, setSelection] = useState<Selection>(NOTHING)
  const [konfirmasi, setKonfirmasi] = useState<BulkAction | null>(null)

  const rows = props.state.kind === 'ready' ? props.state.rows : []
  const pageIds = rows.map(props.rowId)
  const total = props.state.kind === 'ready' ? props.state.total : 0

  const semuaHalamanTerpilih = isPageFullySelected(selection, pageIds)
  const bolehPilihSeluruhHasil =
    selection.mode === 'page' && semuaHalamanTerpilih && total > pageIds.length

  return (
    <div className={styles.wrap} data-density={props.density ?? 'comfortable'}>
      {selection.mode !== 'none' ? (
        <div className={styles.selectionBar}>
          {/* Kalimat yang membedakan kedua mode, selalu terlihat selama mode aktif. */}
          <span className={styles.selectionText} aria-live="polite">
            {describeSelection(selection)}
          </span>

          {bolehPilihSeluruhHasil ? (
            // Satu-satunya jalan menuju mode `query`, dan ia menyebutkan angkanya.
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelection(selectAllMatching(props.filter, total))}
            >
              {`Pilih semua ${total} baris yang cocok dengan filter`}
            </Button>
          ) : null}

          {(props.bulkActions ?? []).map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.destructive === true ? 'danger' : 'secondary'}
              onClick={() => setKonfirmasi(action)}
            >
              {action.label}
            </Button>
          ))}

          <Button variant="ghost" size="sm" onClick={() => setSelection(NOTHING)}>
            Batalkan pilihan
          </Button>
        </div>
      ) : null}

      {konfirmasi === null ? null : (
        <div role="alertdialog" aria-label="Konfirmasi aksi massal" className={styles.confirm}>
          {/* Jumlah DAN nama company — pemeriksaan terakhir sebelum kesalahan
              menjadi permanen. */}
          <p>{`${konfirmasi.label} ${selectionCount(selection)} baris di ${props.companyName}?`}</p>
          <div className={styles.emptyActions}>
            <Button variant="ghost" size="sm" onClick={() => setKonfirmasi(null)}>
              Batal
            </Button>
            <Button
              variant={konfirmasi.destructive === true ? 'danger' : 'primary'}
              size="sm"
              onClick={() => {
                void konfirmasi.run(selection)
                setKonfirmasi(null)
                setSelection(NOTHING)
              }}
            >
              Lanjutkan
            </Button>
          </div>
        </div>
      )}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>{props.caption}</caption>

          <thead className={styles.head}>
            <tr>
              <th scope="col" className={styles.selectCell}>
                <Checkbox
                  label="Pilih baris di halaman ini"
                  checked={semuaHalamanTerpilih}
                  indeterminate={isPagePartiallySelected(selection, pageIds)}
                  onChange={() => setSelection(togglePage(selection, pageIds))}
                />
              </th>

              {props.columns.map((column) => {
                const arah = sortDirectionOf(props.sort, column.id)
                const peringkat = props.sort.findIndex((entry) => entry.columnId === column.id)

                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={column.align === 'end' ? styles.headEnd : undefined}
                    aria-sort={
                      arah === null ? undefined : arah === 'asc' ? 'ascending' : 'descending'
                    }
                  >
                    {column.sortable === true ? (
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={(event) =>
                          props.onSortChange(applySort(props.sort, column.id, event.shiftKey))
                        }
                      >
                        {column.header}
                        {props.sort.length > 1 && peringkat >= 0 ? (
                          <span className={styles.sortRank}>{peringkat + 1}</span>
                        ) : null}
                      </button>
                    ) : (
                      <span className={styles.plainHeader}>{column.header}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {props.state.kind === 'loading'
              ? // Skeleton memakai definisi kolom yang sama, sehingga jumlah kolom
                // dan tinggi barisnya tidak dapat berbeda dari tabel terisi.
                Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <tr key={index} className={styles.row}>
                    <td />
                    {props.columns.map((column) => (
                      <td key={column.id}>
                        <span className={styles.skeletonCell} aria-hidden="true" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = props.rowId(row)
                  return (
                    <tr key={id} className={styles.row}>
                      <td className={styles.selectCell}>
                        <Checkbox
                          label={`Pilih baris ${id}`}
                          checked={isRowSelected(selection, id)}
                          onChange={() => setSelection(toggleRow(selection, id))}
                        />
                      </td>
                      {props.columns.map((column) => (
                        <td
                          key={column.id}
                          // Label kolom ikut dibawa sel supaya baris dapat
                          // berubah menjadi kartu di ponsel tanpa kehilangan
                          // header-nya — Layout_System §5.
                          data-label={column.header}
                          className={column.align === 'end' ? styles.cellEnd : undefined}
                        >
                          {/* Baris dibuka lewat tautan di kolom identifier —
                              elemen yang memang dapat difokus keyboard. */}
                          {column.identifier === true ? (
                            <a href={props.rowHref(row)}>{column.cell(row)}</a>
                          ) : (
                            column.cell(row)
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {props.state.kind === 'ready' || props.state.kind === 'loading' ? null : (
        <EmptyState
          state={props.state}
          action={props.emptyAction}
          onRetry={props.onRetry}
          onClearFilters={props.onClearFilters}
        />
      )}

      {props.state.kind === 'ready' ? (
        <div className={styles.footer}>
          {/* `total` tetap wajib meski pagination berbasis kursor: teks
              "pilih semua N" bergantung padanya — D-041. */}
          <span>{`${rows.length} dari ${total} baris`}</span>
          <div className={styles.pager}>
            <Button
              variant="secondary"
              size="sm"
              disabled={props.state.nextCursor === null}
              onClick={() => {
                if (props.state.kind === 'ready' && props.state.nextCursor !== null) {
                  props.onNextPage?.(props.state.nextCursor)
                }
              }}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EmptyState({
  state,
  action,
  onRetry,
  onClearFilters,
}: {
  state: Extract<TableState<unknown>, { kind: 'empty' | 'no_match' | 'error' }>
  action: ReactNode
  onRetry: (() => void) | undefined
  onClearFilters: (() => void) | undefined
}): ReactNode {
  if (state.kind === 'empty') {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Belum ada data di sini</p>
        <p>Dokumen yang Anda buat akan muncul di daftar ini.</p>
        <div className={styles.emptyActions}>{action}</div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className={styles.empty} role="alert">
        <p className={styles.emptyTitle}>Gagal memuat data</p>
        <p>{state.message}</p>
        <div className={styles.emptyActions}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      </div>
    )
  }

  // Tidak ada hasil — berbeda dari belum ada data. Tanpa ringkasan filter,
  // pengguna yang salah menyetel filter akan menyimpulkan datanya hilang.
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>Tidak ada hasil untuk filter ini</p>
      <p>Filter yang sedang aktif:</p>
      <div className={styles.filterSummary}>
        {state.activeFilters.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className={styles.emptyActions}>
        <Button variant="secondary" size="sm" onClick={onClearFilters}>
          Hapus filter
        </Button>
      </div>
    </div>
  )
}
