import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronDown, Clock3, Database, Info, Search, SlidersHorizontal } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');
const timeLabel = (minute) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

function App() {
  const [dataset, setDataset] = useState(null);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [viewMode, setViewMode] = useState('targets');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState('ALL');
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    fetch('/data/heatmap.json')
      .then((r) => {
        if (!r.ok) throw new Error('Gagal memuat dataset');
        return r.json();
      })
      .then(setDataset)
      .catch((e) => console.error(e));
  }, []);

  const period = dataset?.periods?.[periodIndex];
  const rows = useMemo(() => {
    if (!period || !dataset) return [];
    const normalizedQuery = query.trim();
    if (viewMode === 'periods') {
      const targetIndex = dataset.targets_pips.indexOf(50);
      return Array.from({ length: 1440 }, (_, minute) => ({
        minute, time: timeLabel(minute),
        cells: dataset.periods.map((p, periodColumnIndex) => ({
          cell: p.cells[minute][targetIndex], target: 50, targetIndex,
          periodLabel: p.label, periodColumnIndex
        })).filter(({ cell }) => direction === 'ALL' || cell[0] === direction)
      })).filter((row) => !normalizedQuery || row.time.includes(normalizedQuery));
    }
    return period.cells
      .map((cells, minute) => ({ minute, time: timeLabel(minute), cells }))
      .filter((row) => !normalizedQuery || row.time.includes(normalizedQuery))
      .map((row) => ({
        ...row,
        cells: row.cells.map((cell, targetIndex) => ({ cell, target: dataset.targets_pips[targetIndex], targetIndex }))
          .filter(({ cell }) => direction === 'ALL' || cell[0] === direction)
      }));
  }, [period, dataset, query, direction, viewMode]);

  const stats = useMemo(() => {
    if (!period || !dataset) return null;
    let up = 0, down = 0, neutral = 0, total = 0;
    for (const row of period.cells) for (const cell of row) {
      total++;
      if (cell[0] === 'UP') up++;
      else if (cell[0] === 'DOWN') down++;
      else neutral++;
    }
    return { up, down, neutral, total };
  }, [period, dataset]);

  const toneClass = (cell) => {
    const [dir, probability, observations] = cell;
    if (!observations || dir === 'NEUTRAL') return 'neutral';
    const strength = probability >= 65 ? 'strong' : probability >= 60 ? 'medium' : probability >= 55 ? 'light' : 'soft';
    return `${dir.toLowerCase()} ${strength}`;
  };

  if (!dataset) return <main className="loading"><div className="loader" /><p>Memuat dataset heatmap yang dipulihkan…</p></main>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="TM Chrono Heatmap home">
          <span className="brand-mark"><Activity size={21} /></span>
          <span><strong>TRADER MINORITAS</strong><small>CHRONO HEATMAP</small></span>
        </a>
        <div className="topbar-right"><span className="status-dot" /> Dataset tersedia <span className="topbar-divider" /> <span className="date-stamp">Updated {dataset.last_updated}</span></div>
      </header>

      <main className="content">
        <section className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> HISTORICAL MARKET STATISTICS</div>
          <h1>Chrono <span>Heatmap</span></h1>
          <p className="subtitle">Jelajahi kecenderungan pergerakan harga berdasarkan waktu dan target pip dari data historis.</p>
          <div className="notice"><Info size={16} /><span>Statistik kecenderungan historis — bukan prediksi, sinyal, atau rekomendasi trading.</span></div>
        </section>

        <section className="view-mode-panel">
          <span className="view-mode-label">TAMPILAN HEATMAP</span>
          <button className={`view-mode-button ${viewMode === 'targets' ? 'active' : ''}`} onClick={() => { setViewMode('targets'); setSelectedCell(null); }}>Target pip per periode</button>
          <button className={`view-mode-button ${viewMode === 'periods' ? 'active' : ''}`} onClick={() => { setViewMode('periods'); setSelectedCell(null); }}>Perbandingan periode · ±50 pip</button>
        </section>

        {viewMode === 'targets' && <section className="control-panel">
          <div className="control-label"><CalendarDays size={16} /><span>Periode historis</span></div>
          <div className="period-options">
            {dataset.periods.map((item, index) => (
              <button key={item.label} className={`period-button ${periodIndex === index ? 'active' : ''}`} onClick={() => { setPeriodIndex(index); setSelectedCell(null); }}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="period-range"><span>Rentang data</span><strong>{period.from} <span className="range-arrow">→</span> {period.until}</strong></div>
        </section>}

        {viewMode === 'targets' && <section className="stats-grid">
          <div className="stat-card"><div className="stat-top"><span>UP records</span><span className="stat-icon up-icon"><Activity size={17} /></span></div><strong>{stats.up.toLocaleString('id-ID')}</strong><small>Sel dengan arah naik</small></div>
          <div className="stat-card"><div className="stat-top"><span>DOWN records</span><span className="stat-icon down-icon"><Activity size={17} /></span></div><strong>{stats.down.toLocaleString('id-ID')}</strong><small>Sel dengan arah turun</small></div>
          <div className="stat-card"><div className="stat-top"><span>Neutral records</span><span className="stat-icon neutral-icon"><Database size={17} /></span></div><strong>{stats.neutral.toLocaleString('id-ID')}</strong><small>Sel netral / tanpa arah dominan</small></div>
          <div className="stat-card"><div className="stat-top"><span>Spread assumption</span><span className="stat-icon neutral-icon"><SlidersHorizontal size={17} /></span></div><strong>{dataset.spread_assumption_pips} <em>pip</em></strong><small>Asumsi spread pada sumber</small></div>
        </section>}

        <section className="heatmap-section">
          <div className="heatmap-heading">
            <div><div className="section-kicker"><Clock3 size={15} /> 24-HOUR OVERVIEW</div><h2>{viewMode === 'periods' ? 'Time × Historical Period' : 'Time × Pip Target'}</h2><p>{viewMode === 'periods' ? 'Bandingkan enam periode historis untuk target ±50 pip, seperti tampilan Chrono Heatmap 2.' : 'Setiap sel berisi arah dominan, probabilitas, dan jumlah observasi.'}</p></div>
            <div className="legend"><span><i className="legend-dot up" /> UP</span><span><i className="legend-dot down" /> DOWN</span><span><i className="legend-dot neutral" /> NEUTRAL</span></div>
          </div>

          <div className="table-tools">
            <label className="search-box"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari waktu, mis. 09:30" aria-label="Cari waktu" /><kbd>HH:MM</kbd></label>
            <label className="direction-select"><span>Arah</span><select value={direction} onChange={(e) => setDirection(e.target.value)}><option value="ALL">Semua</option><option value="UP">UP</option><option value="DOWN">DOWN</option><option value="NEUTRAL">NEUTRAL</option></select><ChevronDown size={14} /></label>
          </div>

          <div className="heatmap-wrap">
            <table className="heatmap-table">
              <thead><tr><th className="time-head">WAKTU<br/><small>WIB</small></th>{(viewMode === 'periods' ? dataset.periods.map((p) => p.label) : dataset.targets_pips.map((target) => `±${target}`)).map((label) => <th key={label}>{label}<small>{viewMode === 'periods' ? '±50 pip' : 'pip'}</small></th>)}</tr></thead>
              <tbody>
                {rows.map((row) => <tr key={row.minute}>
                  <th className="time-cell">{row.time}</th>
                  {row.cells.map(({ cell, target, targetIndex, periodLabel, periodColumnIndex }) => (
                    <td key={viewMode === 'periods' ? periodLabel : target} className="heat-cell-wrap">
                      <button className={`heat-cell ${toneClass(cell)} ${selectedCell?.minute === row.minute && selectedCell?.targetIndex === targetIndex && (viewMode !== 'periods' || selectedCell?.periodColumnIndex === periodColumnIndex) ? 'selected' : ''}`}
                        onClick={() => setSelectedCell({ minute: row.minute, time: row.time, target, targetIndex, periodLabel, periodColumnIndex, cell })}
                        title={`${row.time} · ${viewMode === 'periods' ? `${periodLabel} · ` : ''}±${target} pip · ${cell[0]} · ${cell[1].toFixed(1)}% · ${cell[2]} observasi · ${cell[3]} void`}>
                        <span>{cell[0]}</span><strong>{cell[1].toFixed(1)}%</strong>
                      </button>
                    </td>
                  ))}
                </tr>)}
                {rows.length === 0 && <tr><td colSpan={viewMode === 'periods' ? 7 : 11} className="empty-state">Tidak ada waktu yang cocok dengan pencarian.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="table-footer"><span>Menampilkan {rows.length.toLocaleString('id-ID')} dari 1.440 menit per hari {viewMode === 'periods' ? '· target ±50 pip' : ''}</span><span><i className="tiny-dot" /> Dataset historis dipulihkan dari HTML sumber</span></div>
        </section>

        {selectedCell && <section className="detail-panel">
          <div><div className="section-kicker">DETAIL SEL TERPILIH</div><h3>{selectedCell.time} WIB <span>·</span> {selectedCell.periodLabel ? `${selectedCell.periodLabel} · ` : ''}±{selectedCell.target} pip</h3></div>
          <div className="detail-values">
            <div><small>Direction</small><strong className={selectedCell.cell[0].toLowerCase()}>{selectedCell.cell[0]}</strong></div>
            <div><small>Probability</small><strong>{selectedCell.cell[1].toFixed(2)}%</strong></div>
            <div><small>Observations</small><strong>{selectedCell.cell[2].toLocaleString('id-ID')}</strong></div>
            <div><small>Void</small><strong>{selectedCell.cell[3].toLocaleString('id-ID')}</strong></div>
          </div>
        </section>}

        <section className="source-note"><Info size={17}/><div><strong>Catatan sumber data</strong><p>Dataset di aplikasi ini dipulihkan dari payload terenkode pada file HTML yang kamu unggah. Metadata sumber mencatat pembaruan terakhir <b>{dataset.last_updated}</b> dan asumsi spread {dataset.spread_assumption_pips} pip. Angka-angka ini tidak dihitung ulang dari feed pasar live. Hasil historis tidak menjamin hasil di masa depan.</p></div></section>
        <footer><span>TM CHRONO HEATMAP</span><span>Historical tendency only · Not financial advice</span></footer>
      </main>
    </div>
  );
}

export default App;
