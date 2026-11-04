# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Inactive, local CTA overlay. Seconds are semantic word onsets, never normalized."""
from PIL import Image,ImageDraw
import math

def progress(t,start,duration):
 p=max(0,min(1,(t-start)/duration));return p*p*(3-2*p)

def draw_cta(im,t,anchors,font,y=758,durations=None):
 """Draw illustrative comment→like→follow; never performs platform actions.
 anchors: reveal/comment/like/follow seconds relative to the caller's scene.
 """
 durations=durations or {'comment':.30,'like':.28,'follow':.20}
 ink='#20332F';paper='#FFFEF7';orange='#F18A5F';green='#307D6C'
 if not anchors['comment'] < anchors['like'] < anchors['follow']:
  raise ValueError('CTA anchors must preserve spoken comment, like, follow order')
 reveal=progress(t,anchors['reveal'],.24)
 if reveal<=0:return im
 overlay=Image.new('RGBA',im.size);d=ImageDraw.Draw(overlay)
 for i,label in enumerate(['留言','点赞','关注']):
  x=400+i*390;start=anchors[['comment','like','follow'][i]];q=progress(t,start,durations[['comment','like','follow'][i]]);active=t>=start
  # One local press then release, no ambient oscillation or counterfeit count.
  press=6*math.sin(math.pi*max(0,min(1,(t-start)/.20))) if active else 0
  yy=y+int(press);bg=orange if i==1 and active else ('#A9DECE' if i==2 and active else paper)
  d.rounded_rectangle((x,yy,x+340,yy+108),22,fill=bg,outline=ink,width=3)
  if i==0:
   w=46+int(30*q);h=35+int(17*q)
   d.rounded_rectangle((x+28,yy+23,x+28+w,yy+23+h),10,fill='#D1F3EE',outline=ink,width=3)
   d.line([(x+42,yy+23+h),(x+38,yy+32+h),(x+55,yy+23+h)],fill=ink,width=3)
   if q>.15:
    for j in range(2):d.line((x+40,yy+36+j*12,x+40+int(45*q),yy+36+j*12),fill=green,width=3)
  elif i==1:
   pts=[(x+42,yy+75),(x+42,yy+44),(x+57,yy+25),(x+66,yy+25),(x+65,yy+43),(x+87,yy+43),(x+92,yy+51),(x+84,yy+75)]
   d.polygon(pts,fill=paper,outline=ink,width=3);d.rectangle((x+29,yy+46,x+40,yy+76),fill=green)
   if 0<q<1:
    for a in [-.8,-1.57,-2.3]:
     r=40+14*q;cx=x+62;cy=yy+48
     d.line((cx+math.cos(a)*r,cy+math.sin(a)*r,cx+math.cos(a)*(r+9),cy+math.sin(a)*(r+9)),fill=orange,width=4)
  else:
   if q<.5:d.line((x+38,yy+53,x+80,yy+53),fill=ink,width=4);d.line((x+59,yy+32,x+59,yy+74),fill=ink,width=4)
   else:d.line([(x+36,yy+53),(x+52,yy+68),(x+82,yy+34)],fill=green,width=6)
  shown='已关注' if i==2 and q>=.5 else label
  d.text((x+125,yy+24),shown,font=font(39,True),fill=ink)
 d.text((1550,y+36),'动画示意',font=font(22,False),fill=green)
 overlay.putalpha(overlay.getchannel('A').point(lambda a:int(a*reveal)))
 im.alpha_composite(overlay);return im
