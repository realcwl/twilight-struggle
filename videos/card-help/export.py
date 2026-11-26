"""Export the approved map-2 delivery set."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('export-real.py')), run_name='__main__')
