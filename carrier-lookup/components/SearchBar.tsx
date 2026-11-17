"use client";

import { FormEvent, KeyboardEvent, useId } from "react";

const EXAMPLES = [
  "350 Fifth Avenue, New York, NY 10118",
  "1600 Pennsylvania Avenue NW, Washington, DC 20500",
];

type SearchBarProps = {
  address: string;
  loading: boolean;
  suggestions: string[];
  open: boolean;
  active: number;
  onAddressChange: (value: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onActiveChange: (index: number) => void;
  onSearch: (value: string) => void;
};

export function SearchBar({
  address,
  loading,
  suggestions,
  open,
  active,
  onAddressChange,
  onOpen,
  onClose,
  onActiveChange,
  onSearch,
}: SearchBarProps) {
  const listId = useId();
  const showList = open && suggestions.length > 0;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const chosen = active >= 0 && suggestions[active] ? suggestions[active] : address;
    onSearch(chosen);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (event.key === "Escape") onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onActiveChange((active + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onActiveChange(active <= 0 ? suggestions.length - 1 : active - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <section className="card search-card" aria-label="Address search">
      <form className="search-form" onSubmit={onSubmit} role="search">
        <div className="search-row">
          <div className="combo">
            <label className="field-label" htmlFor="address">
              Street address
            </label>
            <div className="field-box">
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.25" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                id="address"
                type="search"
                name="address"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder="350 Fifth Avenue, New York, NY 10118"
                value={address}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={listId}
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                onChange={(event) => {
                  onAddressChange(event.target.value);
                  onOpen();
                  onActiveChange(-1);
                }}
                onFocus={onOpen}
                onBlur={onClose}
                onKeyDown={onKeyDown}
              />
            </div>
            {showList && (
              <ul className="suggestions" id={listId} role="listbox">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion} role="presentation">
                    <button
                      type="button"
                      role="option"
                      id={`${listId}-${index}`}
                      aria-selected={index === active}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSearch(suggestion)}
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Looking up…" : "Look up"}
          </button>
        </div>
        <div className="examples">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="ghost" onClick={() => onSearch(example)}>
              {example}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
