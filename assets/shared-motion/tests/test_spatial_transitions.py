# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from spatial_transitions import Anchor,transition_seconds,progress_seconds
from PIL import Image

class SpatialTests(unittest.TestCase):
 def setUp(self):self.a=Image.new('RGBA',(120,80),'red');self.b=Image.new('RGBA',(120,80),'blue')
 def test_slide_endpoints_both_directions(self):
  for d in ['left','right']:
   self.assertEqual(transition_seconds(self.a,self.b,4,4,.6,direction=d).tobytes(),self.a.tobytes())
   self.assertEqual(transition_seconds(self.a,self.b,4.6,4,.6,direction=d).tobytes(),self.b.tobytes())
 def test_seam_no_background(self):
  for j in range(61):
   im=transition_seconds(self.a,self.b,j/60,0,1,background='green')
   self.assertTrue(set(im.getdata())<={(255,0,0,255),(0,0,255,255)})
 def test_actual_seconds_translation_invariance(self):
  self.assertEqual(transition_seconds(self.a,self.b,.2,0,.6).tobytes(),transition_seconds(self.a,self.b,10.2,10,.6).tobytes())
 def test_anchor_endpoints_and_velocity(self):
  a=Anchor(self.a,(0,0,10,10),(100,20,10,10),(20,0,0,0),(30,0,0,0));eps=1e-5
  self.assertEqual(a.box_at(2,2,1),(0,0,10,10));self.assertEqual(a.box_at(3,2,1),(100,20,10,10))
  self.assertAlmostEqual((a.box_at(2+eps,2,1)[0]-0)/eps,20,delta=.01)
  self.assertAlmostEqual((100-a.box_at(3-eps,2,1)[0])/eps,30,delta=.01)
 def test_v4_endpoints(self):
  for k in ('flip','radial'):
   self.assertEqual(transition_seconds(self.a,self.b,0,0,1,kind=k).tobytes(),self.a.tobytes())
   self.assertEqual(transition_seconds(self.a,self.b,1,0,1,kind=k).tobytes(),self.b.tobytes())
 def test_transparent_region_replaces_old_pixels(self):
  a=Image.new('RGBA',(120,80),(0,0,0,0));b=a.copy()
  a.paste((255,0,0,255),(20,10,100,70));b.paste((0,0,255,255),(20,10,100,70))
  box=(20,10,100,70)
  for kind in ('flip','radial'):
   for t in (0,.25,.5,.75,1):
    got=transition_seconds(a,b,t,0,1,kind=kind,region=box,background='#00000000')
    direct=transition_seconds(a.crop(box),b.crop(box),t,0,1,kind=kind,background='#00000000')
    self.assertEqual(got.crop(box).tobytes(),direct.tobytes())
    self.assertEqual(got.getpixel((0,0)),(0,0,0,0))
 def test_transparent_incoming_endpoint_clears_old_region(self):
  b=Image.new('RGBA',self.a.size,(0,0,0,0));box=(10,10,100,70)
  for kind in ('flip','radial'):
   got=transition_seconds(self.a,b,1,0,1,kind=kind,region=box,background='#00000000')
   self.assertEqual(got.crop(box).tobytes(),b.crop(box).tobytes())
   self.assertEqual(got.getpixel((0,0)),(255,0,0,255))
 def test_invalid(self):
  for duration in [0,-1,float('nan')]:
   with self.assertRaises(ValueError):progress_seconds(0,0,duration)
  with self.assertRaises(ValueError):transition_seconds(self.a,self.b,0,0,1,region=(0,0,30,30))
  with self.assertRaises(ValueError):transition_seconds(self.a,self.b,0,0,1,direction='up')
  with self.assertRaises(ValueError):transition_seconds(self.a,self.b,0,0,1,kind='radial',region=(-1,0,30,30))
if __name__=='__main__':unittest.main()
