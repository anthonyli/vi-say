# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Shared style, font checks and deterministic poster composition."""
from functools import lru_cache
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/production'
STYLE = json.loads((ASSETS / 'style.json').read_text())
C = STYLE['palette']


def font_path(explicit=None):
    value = explicit or os.environ.get('VIDEO_FONT_BOLD')
    if value:
        p = Path(value).expanduser().resolve()
        if not p.is_file():
            raise ValueError('Configured font does not exist: '+str(p))
        return p
    choices = [str(ROOT/'.cache/fonts/NotoSansCJKsc-Black.otf'), '/System/Library/Fonts/STHeiti Medium.ttc',
               '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
               '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Bold.otf',
               'C:/Windows/Fonts/msyhbd.ttc']
    for value in choices:
        if Path(value).is_file():
            return Path(value)
    raise ValueError('Set VIDEO_FONT_BOLD to a licensed Chinese font file')


@lru_cache(64)
def font(path, size):
    return ImageFont.truetype(str(path), size, index=1 if Path(path).name.startswith('STHeiti') else 0)


def wrap(text, f, width):
    lines, line = [], ''
    for char in text:
        if char == '\n':
            lines.append(line); line = ''; continue
        if f.getlength(line+char) > width and line:
            lines.append(line); line = char
        else:
            line += char
    if line:
        lines.append(line)
    return lines


def fit_text(text, path, box, *, maximum, minimum, max_lines, spacing=1.16):
    if not isinstance(text, str) or not text.strip():
        raise ValueError('Text must be nonempty')
    _, _, width, height = box
    for size in range(maximum, minimum-1, -2):
        f = font(str(path), size)
        lines = wrap(text, f, width)
        if len(lines) <= max_lines and len(lines)*size*spacing <= height and all(f.getlength(s)<=width for s in lines):
            return f, lines, round(size*spacing)
    raise ValueError('Text cannot fit at readable size; shorten it or change the layout: '+text)


def text_block(im, text, path, box, *, maximum, minimum, max_lines, color):
    f, lines, step = fit_text(text, path, box, maximum=maximum, minimum=minimum, max_lines=max_lines)
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        # Anchor at actual ink top rather than platform-dependent ascender padding.
        d.text((box[0],box[1]+i*step), line, font=f, fill=color, anchor='lt', stroke_width=1 if maximum>=80 else 0)
    return {'box':list(box),'font_size':f.size,'lines':lines}


def character_image():
    im = Image.open(ASSETS/STYLE['character']['file']).convert('RGBA')
    if im.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Dragon must have real transparent background')
    return im


def round_stroke(im, points, color, width=18):
    """Antialiased capsule ends, including diagonal accents."""
    scale=4;pad=width+3
    left=int(min(x for x,y in points)-pad);top=int(min(y for x,y in points)-pad)
    right=int(max(x for x,y in points)+pad+1);bottom=int(max(y for x,y in points)+pad+1)
    layer=Image.new('RGBA',((right-left)*scale,(bottom-top)*scale))
    draw=ImageDraw.Draw(layer);coords=[((x-left)*scale,(y-top)*scale) for x,y in points]
    draw.line(coords,fill=color,width=width*scale,joint='curve')
    r=width*scale/2
    for x,y in [coords[0],coords[-1]]:draw.ellipse((x-r,y-r,x+r,y+r),fill=color)
    im.alpha_composite(layer.resize((right-left,bottom-top),Image.Resampling.LANCZOS),(left,top))


def sticker_title(im, line, xy, f, colors, emphasis=''):
    """Gently round glyph corners and use a warm shallow sticker shadow."""
    pad=24;size=(int(f.getlength(line))+pad*2+8,int(f.size*1.5)+pad*2)
    mask=Image.new('L',size);draw=ImageDraw.Draw(mask)
    draw.text((pad,pad),line,font=f,fill=255,stroke_width=1,anchor='lt')
    # A short smooth threshold rounds sharp tips without blurring the final text.
    mask=mask.filter(ImageFilter.GaussianBlur(1.6)).point(lambda x:max(0,min(255,(x-90)*4)))
    outline=mask.filter(ImageFilter.MaxFilter(19)).filter(ImageFilter.GaussianBlur(1.1)).point(lambda x:max(0,min(255,(x-80)*4)))
    origin=(int(xy[0]-pad),int(xy[1]-pad))
    shadow=Image.new('RGBA',size,colors['accent']);shadow.putalpha(outline.point(lambda x:int(x*.35)))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(1.2)),(origin[0]+2,origin[1]+7))
    border=Image.new('RGBA',size,colors['white']);border.putalpha(outline);im.alpha_composite(border,origin)
    face=Image.new('RGBA',size,colors['black'])
    if emphasis and emphasis in line:
        start=f.getlength(line.split(emphasis,1)[0]);end=start+f.getlength(emphasis)
        ImageDraw.Draw(face).rectangle((pad+start-2,0,pad+end+2,size[1]),fill=colors['accent'])
    face.putalpha(mask);im.alpha_composite(face,origin)


def poster(title, subtitle, label, aspect, font_file, options=None):
    """Bold outlined typography and topic visual; dragon is a series companion."""
    options=options or {};w,h=STYLE['covers'][aspect];portrait=h>w
    theme=options.get('theme','yellow-comic')
    if theme!='yellow-comic':raise ValueError('Use yellow-comic or customize style.json poster.palette')
    P=STYLE['poster']['palette'];C={'black':P['black'],'white':P['white']}
    im=Image.new('RGBA',(w,h),P['background']);d=ImageDraw.Draw(im)
    # Reuse the previous series' comic hierarchy, not its old yellow/orange hexes.
    d.polygon([(w*.65,0),(w,0),(w,h*.22),(w*.88,h*.17)],fill=P['background'])
    d.polygon([(0,h*.67),(w*.44,h*.83),(0,h*.94)],fill=P['background'])
    round_stroke(im,[(w*.88,h*.14),(w*.94,h*.09)],P['accent'])
    round_stroke(im,[(w*.90,h*.18),(w*.97,h*.17)],P['accent'])
    margin=60 if portrait else 75
    lf=font(str(font_file),30)
    if not label or lf.getlength(label)>w-2*margin-60:raise ValueError('Poster series label is too long')
    lw=int(lf.getlength(label))+54
    d.rounded_rectangle((margin,55,margin+lw,123),radius=34,fill=C['white'],outline=C['black'],width=4)
    d.text((margin+27,73),label,font=lf,fill=C['black'],anchor='lt')
    if portrait:
        title_box=(60,185,w-120,370);sub_box=(78,605,w-156,76)
        dragon_box=(520,770,500,560);visual_box=(60,790,530,390)
        tag_y=1335
    else:
        title_box=(75,245,int(w*.56)-95,360);sub_box=(95,660,int(w*.55)-100,95)
        dragon_box=(int(w*.64),300,int(w*.32),650);visual_box=(int(w*.58),200,int(w*.3),300)
        tag_y=920
    f,lines,step=fit_text(title,font_file,title_box,maximum=180 if portrait else 162,minimum=76,max_lines=2,spacing=1.18)
    bounds=[{'box':list(title_box),'font_size':f.size,'lines':lines}]
    for i,line in enumerate(lines):
        x,y=title_box[0],title_box[1]+i*step
        sticker_title(im,line,(x,y),f,P,options.get('emphasis',''))
    sx,sy,sw,sh=sub_box
    d.rounded_rectangle((sx-18,sy-18,sx+sw+18,sy+sh+12),radius=32,fill=C['white'],outline=C['black'],width=3)
    bounds.append(text_block(im,subtitle,font_file,sub_box,maximum=38,minimum=30,max_lines=2,color=C['black']))
    # Optional topic-specific artwork is staged in the project, never a fake app screenshot.
    visual=options.get('visual')
    if visual:
        art=Image.open(visual).convert('RGBA');art.thumbnail((visual_box[2],visual_box[3]),Image.Resampling.LANCZOS)
        im.alpha_composite(art,(visual_box[0],visual_box[1]))
    elif options.get('motif')=='speech':
        vx,vy,vw,vh=visual_box
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((vx+8,vy+12,vx+vw+8,vy+vh+12),radius=38,fill=C['black'])
        d.rounded_rectangle((vx,vy,vx+vw,vy+vh),radius=38,fill=C['white'],outline=C['black'],width=4)
        d.text((vx+30,vy+30),'说话 → 文字',font=font(str(font_file),min(48,int(vw/7))),fill=C['black'],anchor='lt')
        for j,height in enumerate([35,65,110,150,95,55,105,65,30]):
            bx=vx+35+j*(vw-70)/9;cy=vy+vh*.52
            d.rounded_rectangle((bx,cy-height/2,bx+18,cy+height/2),radius=9,fill=P['accent'])
        d.rounded_rectangle((vx+30,vy+vh-74,vx+vw-30,vy+vh-30),radius=14,fill=P['accent'])
        d.text((vx+46,vy+vh-65),'想法，变成文字。',font=font(str(font_file),min(27,int(vw/11))),fill=C['black'],anchor='lt')
    dragon=character_image();dragon.thumbnail((dragon_box[2],dragon_box[3]),Image.Resampling.LANCZOS)
    x=dragon_box[0]+(dragon_box[2]-dragon.width)//2;y=dragon_box[1]+(dragon_box[3]-dragon.height)//2
    # White sticker outline: deterministic alpha dilation, retaining the original illustration.
    from PIL import ImageFilter
    outline=dragon.getchannel('A').filter(ImageFilter.MaxFilter(19))
    sticker=Image.new('RGBA',dragon.size,C['white']);sticker.putalpha(outline);im.alpha_composite(sticker,(x,y));im.alpha_composite(dragon,(x,y))
    tag=options.get('tag','跟着小龙，一起搞懂');tf=font(str(font_file),34)
    if tf.getlength(tag)>w-180:raise ValueError('Poster tag is too long')
    tw=int(tf.getlength(tag))+70;tx=(w-tw)//2
    d=ImageDraw.Draw(im);d.rounded_rectangle((tx,tag_y,tx+tw,tag_y+70),radius=35,fill=P['tag'])
    d.text((tx+35,tag_y+18),tag,font=tf,fill=C['white'],anchor='lt')
    return im.convert('RGB'),{'aspect':aspect,'size':[w,h],'text':bounds,'character_box':[x,y,dragon.width,dragon.height],'layout':'comic-topic','theme':theme,'visual_box':list(visual_box)}
