#!/usr/bin/env python3
"""
Quét thư mục chứa file .ipa và tự sinh apps.json cho trang Sileo Repo.

Cách dùng:
    python3 generate_apps_json.py

Mặc định:
    - Đọc file .ipa từ thư mục ./ipa
    - Ghi ảnh icon (nếu tách được) vào thư mục ./icons
    - Ghi kết quả vào ./apps.json (ở gốc repo, cạnh index.html)

Có thể tuỳ chỉnh qua biến môi trường:
    IPA_DIR=ipa ICONS_DIR=icons OUTPUT=apps.json python3 generate_apps_json.py

Lưu ý về icon: từ iOS 11 trở đi, hầu hết app đóng icon vào Assets.car
(asset catalog nhị phân) mà thư viện chuẩn của Python không đọc được.
Script sẽ thử tìm icon PNG rời (nếu app có ship kèm để tương thích ngược);
nếu không có, field "icon" sẽ để trống — trang web đã có fallback hiện
chữ cái đầu, không vỡ giao diện.
"""

import json
import os
import plistlib
import re
import zipfile
from pathlib import Path

IPA_DIR = Path(os.environ.get("IPA_DIR", "ipa"))
ICONS_DIR = Path(os.environ.get("ICONS_DIR", "icons"))
OUTPUT = Path(os.environ.get("OUTPUT", "apps.json"))


def find_info_plist_path(zf: zipfile.ZipFile):
    """Tìm Payload/<Tên>.app/Info.plist bên trong file ipa (là 1 file zip)."""
    for name in zf.namelist():
        m = re.match(r"^Payload/[^/]+\.app/Info\.plist$", name)
        if m:
            return name
    return None


def find_icon_bytes(zf: zipfile.ZipFile, app_folder: str, plist: dict):
    """Cố tìm 1 icon PNG rời khớp với CFBundleIconFiles, ưu tiên độ phân giải cao nhất."""
    icon_bundle = plist.get("CFBundleIcons") or plist.get("CFBundleIcons~ipad")
    candidates = []
    if icon_bundle:
        primary = icon_bundle.get("CFBundlePrimaryIcon", {})
        candidates.extend(primary.get("CFBundleIconFiles", []))

    # Một số app khai icon trực tiếp ở top-level (kiểu cũ)
    candidates.extend(plist.get("CFBundleIconFiles", []))

    if not candidates:
        return None

    names_in_app = [n for n in zf.namelist() if n.startswith(app_folder) and n.lower().endswith(".png")]

    best_name = None
    best_score = -1
    for base in candidates:
        for n in names_in_app:
            filename = n.rsplit("/", 1)[-1]
            if filename.startswith(base):
                # Ưu tiên @3x > @2x > không hậu tố
                score = 3 if "@3x" in filename else 2 if "@2x" in filename else 1
                if score > best_score:
                    best_score = score
                    best_name = n

    if best_name:
        return zf.read(best_name)
    return None


def format_size(num_bytes: int) -> str:
    mb = num_bytes / (1024 * 1024)
    return f"{mb:.1f} MB"


def main():
    if not IPA_DIR.exists():
        print(f"Không tìm thấy thư mục '{IPA_DIR}'. Tạo thư mục này và đặt các file .ipa vào trong.")
        return

    ipa_files = sorted(IPA_DIR.glob("*.ipa"))
    if not ipa_files:
        print(f"Không có file .ipa nào trong '{IPA_DIR}'.")
        return

    ICONS_DIR.mkdir(exist_ok=True)
    apps = []

    for ipa_path in ipa_files:
        try:
            with zipfile.ZipFile(ipa_path) as zf:
                plist_path = find_info_plist_path(zf)
                if not plist_path:
                    print(f"[Bỏ qua] {ipa_path.name}: không tìm thấy Info.plist")
                    continue

                with zf.open(plist_path) as f:
                    plist = plistlib.load(f)

                app_folder = plist_path.rsplit("/", 1)[0] + "/"
                name = plist.get("CFBundleDisplayName") or plist.get("CFBundleName") or ipa_path.stem
                bundle_id = plist.get("CFBundleIdentifier", "")
                version = plist.get("CFBundleShortVersionString") or plist.get("CFBundleVersion") or ""

                icon_bytes = find_icon_bytes(zf, app_folder, plist)
                icon_rel_path = None
                if icon_bytes:
                    icon_filename = f"{bundle_id or ipa_path.stem}.png"
                    (ICONS_DIR / icon_filename).write_bytes(icon_bytes)
                    icon_rel_path = f"{ICONS_DIR.as_posix()}/{icon_filename}"

                entry = {
                    "name": name,
                    "bundleId": bundle_id,
                    "version": str(version),
                    "size": format_size(ipa_path.stat().st_size),
                    "icon": icon_rel_path or "",
                    "url": f"{IPA_DIR.as_posix()}/{ipa_path.name}",
                }
                apps.append(entry)
                print(f"[OK] {ipa_path.name} -> {name} v{version}" + (" (icon tìm thấy)" if icon_rel_path else " (không có icon rời)"))

        except zipfile.BadZipFile:
            print(f"[Lỗi] {ipa_path.name}: không phải file zip/ipa hợp lệ")
        except Exception as e:
            print(f"[Lỗi] {ipa_path.name}: {e}")

    OUTPUT.write_text(json.dumps(apps, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nĐã ghi {len(apps)} app vào {OUTPUT}")


if __name__ == "__main__":
    main()