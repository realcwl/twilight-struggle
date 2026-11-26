"""The original diagram treatment was rejected. Build the approved real-asset version."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('build-real.py')), run_name='__main__')
