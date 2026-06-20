try:
    import numpy
    print("numpy: OK")
except ImportError:
    print("numpy: Missing")

try:
    import scipy
    print("scipy: OK")
except ImportError:
    print("scipy: Missing")

try:
    import shapely
    print("shapely: OK")
except ImportError:
    print("shapely: Missing")
