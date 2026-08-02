import type { Ref } from "react";
import { SearchIcon } from "../lib/icons";

export function SearchBox({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="search-box board-search">
      <SearchIcon />
      <input
        ref={inputRef}
        placeholder="搜索剧集标题…（/ 快速聚焦）"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="搜索剧集标题"
      />
      {value ? (
        <button className="search-clear" aria-label="清空搜索" onClick={() => onChange("")}>
          ×
        </button>
      ) : null}
    </div>
  );
}
