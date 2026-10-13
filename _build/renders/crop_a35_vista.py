# Recorte de la vista A3-5: excluye las anillas pequeñas, cuyo texto generado no es fiable.
import sys
from PIL import Image
Image.open(sys.argv[1]).convert("RGB").crop((0, 0, 1472, 620)).save(sys.argv[2], optimize=True)
