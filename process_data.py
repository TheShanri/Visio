import io
from typing import Dict, List

import pandas as pd


def _find_header_index(lines: List[str]) -> int:
    """Return the index of the header row in the uploaded file."""

    for index, line in enumerate(lines):
        headers = line.split("\t")
        if {"Elapsed Time", "Scale", "Tot Infused Vol", "Bladder Pressure"}.issubset(
            set(headers)
        ):
            return index
    raise ValueError(
        "Unable to locate the column headers in the uploaded file. "
        "Please verify that the file contains a tab-separated table "
        "with columns for Elapsed Time, Scale, Tot Infused Vol, and Bladder Pressure."
    )


def _build_series(frame: pd.DataFrame, value_column: str) -> List[Dict[str, float]]:
    """Return a list of dictionaries for the requested column."""

    if value_column not in frame.columns:
        return []

    subset = frame[["Elapsed Time", value_column]].dropna(subset=[value_column])
    records: List[Dict[str, float]] = []

    for _, row in subset.iterrows():
        records.append(
            {
                "Elapsed Time": float(row["Elapsed Time"]),
                value_column: float(row[value_column]),
            }
        )

    return records


def process_uploaded_data(text_data: str) -> Dict[str, List[Dict[str, float]]]:
    """Parse, clean, and organise the uploaded text data for visualisation."""

    if not text_data.strip():
        raise ValueError("The uploaded file is empty.")

    lines = text_data.strip().splitlines()

    header_line_index = _find_header_index(lines)
    headers = [header.strip() for header in lines[header_line_index].split("\t")]

    data_lines = [line for line in lines[header_line_index + 1 :] if line.strip()]
    if not data_lines:
        raise ValueError("No data rows were found beneath the header row.")

    csv_data = "\n".join(data_lines)
    frame = pd.read_csv(io.StringIO(csv_data), delimiter="\t", names=headers)

    numeric_columns = ["Elapsed Time", "Scale", "Tot Infused Vol", "Bladder Pressure"]
    for column in numeric_columns:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame = (
        frame.dropna(subset=["Elapsed Time"])
        .sort_values("Elapsed Time")
        .reset_index(drop=True)
    )

    if frame.empty:
        raise ValueError("The uploaded file does not contain valid time-series data.")

    return {
        "scale": _build_series(frame, "Scale"),
        "volume": _build_series(frame, "Tot Infused Vol"),
        "pressure": _build_series(frame, "Bladder Pressure"),
    }
