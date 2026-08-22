#!/usr/bin/env python3
"""
Quét thư mục chứa các file linh tinh (config, plist, chứng chỉ, zip...)
và tự sinh/ cập nhật files.json cho trang Sileo Repo.

Cách dùng:
    python3 generate_files_json.py

Mặc định:
    - Đọc mọi file trong thư mục ./files (kể cả thư mục con)
    - Ghi/cập nhật ./files.json ở gốc repo (cạnh index.html)

Có thể tuỳ chỉnh qua biến môi trường:
    FILES_DIR=files OUTPUT=files.json python3 generate_files_json.py

QUAN TRỌNG — khác với generate_apps_json.py:
File thường (.zip, .mobileconfig, .p12, .plist...) không có metadata mô tả
công dụng như Info.plist trong IPA. Script này CHỈ tự động hoá được:
    - name       (từ tên file)
    - extension  (từ đuôi file)
    - size       (tính thật từ dung lượng file)
    - url        (đường dẫn tương đối)

Còn "description" và "type" thì KHÔNG có gì để tự đọc ra — script để trống
cho file mới. Nếu file đã có trong files.json từ lần chạy trước (khớp theo
"url"), script sẽ GIỮ NGUYÊN description/type bạn đã viết tay, chỉ cập nhật
lại size phòng khi bạn thay file. Nhờ vậy chạy lại nhiều lần không bị mất
công đã điền mô tả.
"""

import json
import os
from pathlib import Path

FILES_DIR = Path(os.environ.get("FILES_DIR", "files"))
OUTPUT = Path(os.environ.get("OUTPUT", "files.json"))


def format_size(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    kb = num_bytes / 1024
    if kb < 1024:
        return f"{kb:.0f} KB"
    mb = kb / 1024
    return f"{mb:.1f} MB"


def prettify_name(stem: str) -> str:
    return stem.replace("_", " ").replace("-", " ").strip().title()


def load_existing(output: Path):
    """Đọc files.json cũ (nếu có) và index theo url để giữ lại mô tả đã viết tay."""
    if not output.exists():
        return {}
    try:
        data = json.loads(output.read_text(encoding="utf-8"))
        return {entry.get("url"): entry for entry in data if isinstance(entry, dict) and entry.get("url")}
    except Exception:
        return {}


def main():
    if not FILES_DIR.exists():
        print(f"Không tìm thấy thư mục '{FILES_DIR}'. Tạo thư mục này và đặt các file cần chia sẻ vào trong.")
        return

    all_files = sorted(p for p in FILES_DIR.rglob("*") if p.is_file())
    if not all_files:
        print(f"Không có file nào trong '{FILES_DIR}'.")
        return

    existing_by_url = load_existing(OUTPUT)
    result = []
    new_count = 0

    for path in all_files:
        rel_url = path.as_posix()
        ext = path.suffix.lstrip(".").lower() or "file"
        size_str = format_size(path.stat().st_size)

        prior = existing_by_url.get(rel_url)
        if prior:
            entry = {
                "name": prior.get("name") or prettify_name(path.stem),
                "extension": ext,
                "type": prior.get("type", ""),
                "size": size_str,
                "description": prior.get("description", ""),
                "url": rel_url,
            }
            print(f"[Giữ nguyên mô tả] {rel_url}")
        else:
            entry = {
                "name": prettify_name(path.stem),
                "extension": ext,
                "type": "",
                "size": size_str,
                "description": "",
                "url": rel_url,
            }
            new_count += 1
            print(f"[Mới] {rel_url} — cần bạn tự điền type/description")

        result.append(entry)

    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nĐã ghi {len(result)} file vào {OUTPUT} ({new_count} file mới cần điền mô tả).")


if __name__ == "__main__":
    main()
