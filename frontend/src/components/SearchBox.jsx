import { useState } from 'react';
import { getCategoryStyle } from '../categoryStyles';

function ResultIcon({ category }) {
  const style = getCategoryStyle(category);
  return (
    <svg
      className="autocomplete-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill={style.stroke}
      stroke={style.stroke}
      strokeWidth="1"
    >
      {style.icon}
    </svg>
  );
}

export default function SearchBox({ policlinics, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches =
    query.trim().length === 0
      ? []
      : policlinics.filter((p) =>
          p.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))
        );

  function handleSelect(p) {
    setQuery(p.name);
    setOpen(false);
    onSelect(p);
  }

  return (
    <div className="search-container">
      <input
        type="text"
        className="search-box"
        placeholder="Poliklinik ara..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <div className="autocomplete-list">
          {matches.map((p) => (
            <div key={p.id} className="autocomplete-item" onClick={() => handleSelect(p)}>
              <ResultIcon category={p.category} />
              <span className="autocomplete-item-name">{p.name}</span>
              <small>Kat {p.floor}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
