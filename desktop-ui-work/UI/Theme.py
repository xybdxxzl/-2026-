from UI.QtBootstrap import configure_qt

# 电脑端统一的颜色、间距和交互状态；不依赖外部字体或图标服务。
STYLE = '''
QWidget { font-family: "Microsoft YaHei UI", "Microsoft YaHei"; font-size: 10pt; color: #23334a; }
QMainWindow, QDialog, QWidget#Window { background: #f3f6fa; }
QGroupBox { background: #ffffff; border: 1px solid #dce5ef; border-radius: 10px; margin-top: 16px; padding: 16px 12px 12px; font-weight: 600; }
QGroupBox::title { subcontrol-origin: margin; left: 14px; color: #334b64; padding: 0 4px; }
QPushButton, QToolButton { background: #ffffff; border: 1px solid #cfdae7; border-radius: 7px; padding: 7px 12px; color: #29445e; }
QPushButton:hover, QToolButton:hover { background: #edf5f6; border-color: #8dbbb8; }
QPushButton:pressed, QToolButton:pressed { background: #dbeeed; }
QPushButton:focus, QToolButton:focus { border: 2px solid #23877e; }
QPushButton:disabled, QToolButton:disabled { color: #8b98a7; background: #f0f3f6; border-color: #e1e7ed; }
QPushButton#primary, QPushButton#active_btn { background: #087e75; color: #ffffff; border: 1px solid #087e75; font-weight: 600; }
QPushButton#primary:hover, QPushButton#active_btn:hover { background: #066c65; border-color: #066c65; }
QPushButton#primary:pressed, QPushButton#active_btn:pressed { background: #075c56; }
QPushButton#primary:focus, QPushButton#active_btn:focus { background: #087e75; color: #ffffff; border: 2px solid #064e49; }
QPushButton#primary:disabled { background: #e6edef; border-color: #e6edef; color: #87969e; }
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox, QPlainTextEdit, QTextBrowser { background: #ffffff; border: 1px solid #ccd9e5; border-radius: 6px; padding: 7px; selection-background-color: #cde9e5; selection-color: #173c3a; }
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus, QPlainTextEdit:focus, QTextBrowser:focus { border: 2px solid #23877e; }
QTableWidget { background: white; alternate-background-color: #f5f9fa; border: none; gridline-color: #e4ecee; }
QHeaderView::section { background: #edf4f4; color: #425f65; border: none; padding: 8px; }
QScrollArea { border: none; background: transparent; }
QScrollArea > QWidget > QWidget { background: #f3f6fa; }
QCheckBox, QRadioButton { spacing: 8px; padding: 3px; }
QProgressBar { background: #e4edef; border: none; border-radius: 4px; }
QProgressBar::chunk { background: #0b8c80; border-radius: 4px; }
QProgressBar[urgent="true"]::chunk { background: #c55a34; }
QLabel#muted { color: #52677b; }
QLabel#label_2 { font-size: 16pt; font-weight: 600; color: #1d354a; }
QLabel#countdown { color: #086c64; font-size: 12pt; font-weight: 600; padding: 8px; background: #e5f4f1; border-radius: 8px; }
QLabel#workspaceAnswer { font-size: 18pt; font-weight: 600; color: #075f59; padding: 4px 0; }
QLabel#workspaceConfidence { color: #49667a; }
QLabel#workspaceHint { color: #526b7b; font-size: 9pt; }
QLabel#workspaceMetrics { color: #536a7d; font-size: 9pt; }
QLabel#workspaceTimer { color: #245b58; font-weight: 600; }
QLabel#workspaceTimer[urgent="true"] { color: #a74728; }
QSplitter::handle { background: transparent; }
QStatusBar { color: #52677b; background: #f3f6fa; }
'''


def apply_theme(widget):
    # 去掉旧界面的行内样式，统一由主题负责。
    from PyQt5.QtWidgets import QWidget
    for child in widget.findChildren(QWidget):
        child.setStyleSheet('')
    widget.setStyleSheet(STYLE)
