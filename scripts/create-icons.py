"""Render the code-native shuttle placeholder to PNG using only Python's stdlib."""
from pathlib import Path
import struct
import zlib

polygons = [((162,143),(203,143),(234,309),(213,309)), ((215,121),(251,121),(251,307),(238,307)), ((265,121),(301,121),(277,307),(264,307)), ((314,143),(350,143),(298,309),(282,309)), ((220,320),(292,320),(283,356),(271,376),(256,384),(241,376),(228,356))]
def inside(x,y,points):
    crossing=False
    for i,(a,b) in enumerate(points):
        c,d=points[i-1]
        if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:
            crossing=not crossing
    return crossing

def write_png(size,filename):
    rows=[]
    for py in range(size):
        row=bytearray([0])
        for px in range(size):
            x=(px+.5)*512/size;y=(py+.5)*512/size
            rgb=(40,92,73)
            if any(inside(x,y,p) for p in polygons):rgb=(244,247,237)
            if 220<=x<=292 and 306<=y<=315:rgb=(175,196,160)
            row.extend(rgb)
        rows.append(bytes(row))
    def chunk(kind,payload):return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
    Path(filename).write_bytes(png)
root=Path(__file__).resolve().parents[1]/'public'/'icons'
for size,name in [(180,'apple-touch-icon.png'),(192,'icon-192.png'),(512,'icon-512.png'),(512,'icon-maskable-512.png')]:write_png(size,root/name)
