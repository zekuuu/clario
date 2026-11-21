import pandas as pd

from app.services.sheet_service import clean_headers, detect_header_index


def test_detects_procurement_header_below_document_titles() -> None:
    frame = pd.DataFrame([
        ["Republic of the Philippines", None, None, None],
        ["Abstract of Bids", None, None, None],
        [None, None, None, None],
        ["Item No", "Description", "Qty", "Unit Cost"],
        [1, "Bond paper", 4, 100],
    ])
    assert detect_header_index(frame) == 3


def test_cleans_blank_and_duplicate_headers() -> None:
    assert clean_headers(["Item", None, "Item", float("nan")]) == ["Item", "Column 2", "Item (2)", "Column 4"]



def test_detects_header_in_workbook_without_dimension_tag(tmp_path) -> None:
    import re
    import zipfile

    import openpyxl

    from app.services.sheet_service import inspect_sheets

    source = tmp_path / "sized.xlsx"
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Items"
    sheet.append(["Warehouse ledger"])
    sheet.append(["Prepared by: team"])
    sheet.append([])
    sheet.append(["Item No", "Description", "Qty", "Unit Cost"])
    sheet.append([1, "Bond paper", 4, 100])
    workbook.save(source)

    unsized = tmp_path / "unsized.xlsx"
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(unsized, "w") as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename.startswith("xl/worksheets/sheet"):
                data = re.sub(rb"<dimension[^>]*/>", b"", data)
            dst.writestr(item, data)

    info = inspect_sheets(unsized)[0]
    assert info.detected_header_row == 4
    assert info.row_count == 5 and info.column_count == 4
