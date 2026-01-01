import React from "react";

type Props = {
  words: number;
  chars: number;
  onSaveLocal?: () => void;
  onLoadLocal?: () => void;
};

export function StatusBar({ words, chars, onSaveLocal, onLoadLocal }: Props) {
  return (
    <div className="statusbar">
      <div className="statusbar__counts">
        Words: {words} • Chars: {chars}
      </div>

      <div className="statusbar__actions">
        {onLoadLocal && (
          <button className="btn" onClick={onLoadLocal}>
            Load local
          </button>
        )}
        {onSaveLocal && (
          <button className="btn primary" onClick={onSaveLocal}>
            Save locally
          </button>
        )}
      </div>
    </div>
  );
}
