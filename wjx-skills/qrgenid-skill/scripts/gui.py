from __future__ import annotations

import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from .core import run
from .excel import get_sheet_names
from .models import RunOptions


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("二维码批量生成工具")
        self.geometry("720x520")
        self.minsize(620, 440)
        self.events: queue.Queue[dict[str, object]] = queue.Queue()
        self.cancel_event = threading.Event()
        self.worker: threading.Thread | None = None
        self.input_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.id_column_var = tk.StringVar(value="A")
        self.url_column_var = tk.StringVar(value="B")
        self.sheet_var = tk.StringVar()
        self.size_var = tk.IntVar(value=150)
        self._build_ui()
        self.after(100, self._poll_events)

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=14)
        root.pack(fill="both", expand=True)
        root.columnconfigure(1, weight=1)
        self._path_row(root, 0, "输入 Excel", self.input_var, self._choose_input)
        self._path_row(root, 1, "输出目录", self.output_var, self._choose_output)
        ttk.Label(root, text="工作表").grid(row=2, column=0, sticky="w", pady=6)
        self.sheet_combo = ttk.Combobox(root, textvariable=self.sheet_var, state="readonly")
        self.sheet_combo.grid(row=2, column=1, sticky="ew", pady=6)
        ttk.Label(root, text="ID 列").grid(row=3, column=0, sticky="w", pady=6)
        ttk.Entry(root, textvariable=self.id_column_var, width=14).grid(row=3, column=1, sticky="w", pady=6)
        ttk.Label(root, text="URL 列").grid(row=4, column=0, sticky="w", pady=6)
        ttk.Entry(root, textvariable=self.url_column_var, width=14).grid(row=4, column=1, sticky="w", pady=6)
        ttk.Label(root, text="二维码主体尺寸").grid(row=5, column=0, sticky="w", pady=6)
        ttk.Combobox(root, textvariable=self.size_var, values=[150, 256, 512], state="readonly", width=12).grid(row=5, column=1, sticky="w", pady=6)
        self.progress = ttk.Progressbar(root, mode="determinate")
        self.progress.grid(row=6, column=0, columnspan=3, sticky="ew", pady=(14, 6))
        self.progress_label = ttk.Label(root, text="等待开始")
        self.progress_label.grid(row=7, column=0, columnspan=3, sticky="w")
        self.log_text = tk.Text(root, height=14, state="disabled", wrap="word")
        self.log_text.grid(row=8, column=0, columnspan=3, sticky="nsew", pady=8)
        root.rowconfigure(8, weight=1)
        buttons = ttk.Frame(root)
        buttons.grid(row=9, column=0, columnspan=3, sticky="e")
        self.start_button = ttk.Button(buttons, text="开始生成", command=self._start)
        self.start_button.pack(side="left", padx=5)
        self.cancel_button = ttk.Button(buttons, text="取消", command=self._cancel, state="disabled")
        self.cancel_button.pack(side="left")

    def _path_row(self, parent: ttk.Frame, row: int, label: str, variable: tk.StringVar, command: object) -> None:
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=6)
        ttk.Entry(parent, textvariable=variable).grid(row=row, column=1, sticky="ew", pady=6)
        ttk.Button(parent, text="选择", command=command).grid(row=row, column=2, padx=(8, 0), pady=6)

    def _choose_input(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("Excel 文件", "*.xlsx *.xls"), ("所有文件", "*.*")])
        if not path:
            return
        self.input_var.set(path)
        try:
            names = get_sheet_names(Path(path))
            self.sheet_combo["values"] = names
            if names:
                self.sheet_var.set(names[0])
        except Exception as exc:
            messagebox.showerror("读取失败", str(exc))

    def _choose_output(self) -> None:
        path = filedialog.askdirectory()
        if path:
            self.output_var.set(path)

    def _append_log(self, text: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert("end", text + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _start(self) -> None:
        if not self.input_var.get().strip():
            messagebox.showwarning("缺少输入", "请选择输入 Excel 文件")
            return
        output_dir = Path(self.output_var.get().strip()) if self.output_var.get().strip() else Path(self.input_var.get()).expanduser().resolve().parent
        output_file = output_dir / "output.xlsx"
        has_old_png = (output_dir / "qrcodes").exists() and any((output_dir / "qrcodes").glob("*.png"))
        if output_file.exists() or has_old_png:
            if not messagebox.askyesno("确认覆盖", "任务会覆盖 output.xlsx，并清空 qrcodes 根目录下的旧 PNG，是否继续？"):
                return
        self.cancel_event.clear()
        self.start_button.configure(state="disabled")
        self.cancel_button.configure(state="normal")
        self._append_log("开始处理")
        options = RunOptions(Path(self.input_var.get()), output_dir, self.id_column_var.get(), self.url_column_var.get(), self.sheet_var.get() or None, None, int(self.size_var.get()))
        self.worker = threading.Thread(target=self._run_worker, args=(options,), daemon=True)
        self.worker.start()

    def _run_worker(self, options: RunOptions) -> None:
        summary = run(options, progress_callback=self.events.put, log_callback=lambda message: self.events.put({"event": "log", "message": message}), cancel_event=self.cancel_event)
        self.events.put({"event": "summary", "summary": summary})

    def _cancel(self) -> None:
        self.cancel_event.set()
        self._append_log("已请求取消，正在整理结果")
        self.cancel_button.configure(state="disabled")

    def _poll_events(self) -> None:
        try:
            while True:
                event = self.events.get_nowait()
                kind = event.get("event")
                if kind == "loaded":
                    total = int(event["total"])
                    self.progress.configure(maximum=max(1, total), value=0)
                    self.progress_label.configure(text=f"已读取 {total} 条记录")
                elif kind == "progress":
                    self.progress.configure(value=int(event["done"]))
                    self.progress_label.configure(text=f"第 {event['row']} 行：{event['status']}（{event['done']}/{event['total']}）")
                elif kind == "log":
                    self._append_log(str(event["message"]))
                elif kind == "finished":
                    self.progress_label.configure(text=f"处理完成：{event['status']}")
                elif kind == "summary":
                    summary = event["summary"]
                    self.start_button.configure(state="normal")
                    self.cancel_button.configure(state="disabled")
                    if summary.status == "error":
                        messagebox.showerror("处理失败", summary.errors[0].failure_reason if summary.errors else "未知错误")
                    else:
                        messagebox.showinfo("处理完成", f"成功 {summary.success_count} 条，失败 {summary.failure_count} 条，取消 {summary.cancelled_count} 条\n输出：{summary.output_file}")
        except queue.Empty:
            pass
        self.after(100, self._poll_events)


def main() -> int:
    App().mainloop()
    return 0

