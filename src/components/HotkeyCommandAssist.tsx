import React, { useId, useMemo, useState } from 'react';
import type { HotkeyBinding } from '../types/hotkey';
import {
  findExactHotkeyCommand,
  suggestHotkeyCommands,
  type HotkeyCommandCandidate,
} from '../utils/hotkeyCommandSuggestions';

interface HotkeyCommandAssistProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  bindings?: HotkeyBinding[];
  seedQuery?: string;
  placeholder?: string;
  initialFocus?: boolean;
}

function sourceLabel(candidate: HotkeyCommandCandidate): string {
  return candidate.source === 'current_workspace' ? '当前配置' : '命令词典';
}

export default function HotkeyCommandAssist({
  id,
  value,
  onChange,
  bindings = [],
  seedQuery = '',
  placeholder,
  initialFocus = false,
}: HotkeyCommandAssistProps) {
  const reactId = useId().replace(/:/g, '');
  const listboxId = `${id}-${reactId}-suggestions`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = value.trim() || seedQuery.trim();
  const suggestions = useMemo(
    () => suggestHotkeyCommands(query, bindings),
    [bindings, query],
  );
  const exactMatch = useMemo(
    () => findExactHotkeyCommand(value, bindings),
    [bindings, value],
  );

  const selectCandidate = (candidate: HotkeyCommandCandidate) => {
    onChange(candidate.command);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === 'Enter' && open && suggestions.length > 0) {
      event.preventDefault();
      selectCandidate(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const showSuggestions = open && suggestions.length > 0;

  return (
    <div className="hotkey-command-assist">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
        aria-activedescendant={showSuggestions ? `${listboxId}-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        data-dialog-initial-focus={initialFocus || undefined}
      />

      {showSuggestions ? (
        <div id={listboxId} className="hotkey-command-suggestions" role="listbox">
          {suggestions.map((candidate, index) => (
            <button
              id={`${listboxId}-${index}`}
              key={candidate.command}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`hotkey-command-suggestion${index === activeIndex ? ' is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectCandidate(candidate)}
            >
              <span className="hotkey-command-suggestion-main">
                <code>{candidate.command}</code>
                <strong>{candidate.chineseName}</strong>
              </span>
              <span className="hotkey-command-suggestion-description">{candidate.description}</span>
              <span className="hotkey-command-suggestion-source">{sourceLabel(candidate)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {exactMatch ? (
        <div className="hotkey-command-assist-status is-match" aria-live="polite">
          已匹配：{exactMatch.chineseName} · {exactMatch.description}
        </div>
      ) : value.trim() ? (
        <div className="hotkey-command-assist-status is-unverified" aria-live="polite">
          词典中未找到精确命令，请先在 Allegro Command 窗口验证后再应用。
        </div>
      ) : (
        <div className="hotkey-command-assist-status">
          可输入英文或中文搜索；↑↓ 选择，Enter 填入。
        </div>
      )}
    </div>
  );
}
