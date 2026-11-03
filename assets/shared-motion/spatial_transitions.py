"""Candidate spatial compositor. Times are actual seconds, never scene-normalized.
Caller draws each scene WITHOUT the migrating anchor, then composites one anchor.
Pillow needed; v4 flip/radial lazy-load their original NumPy implementation.
"""
from dataclasses import dataclass
import importlib.util
import math
from pathlib import Path
from PIL import Image


def finite(x, name):
    if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x):
        raise ValueError(f'{name} must be a finite number')
    return float(x)


def progress_seconds(t, start, duration):
    t, start, duration = (finite(v, n) for v, n in ((t,'t'),(start,'start'),(duration,'duration')))
    if duration <= 0: raise ValueError('duration must be positive seconds')
    return min(1., max(0., (t-start)/duration))


def ease(p):
    # C2 at rest endpoints. Explicitly not applied to every scene object.
    return p*p*p*(p*(p*6-15)+10)


@dataclass(frozen=True)
class Anchor:
    sprite: Image.Image
    from_box: tuple  # x, y, width, height, in output pixel coordinates
    to_box: tuple
    # Optional velocities in pixels/second for x,y,w,h (Hermite tangent).
    # Use zero for stopped handoff; nonzero for a moving object's phase continuity.
    from_velocity: tuple = (0.,0.,0.,0.)
    to_velocity: tuple = (0.,0.,0.,0.)

    def box_at(self, t, start, duration):
        p=progress_seconds(t,start,duration)
        for name, values in [('from_box',self.from_box),('to_box',self.to_box),('from_velocity',self.from_velocity),('to_velocity',self.to_velocity)]:
            if len(values)!=4: raise ValueError(name+' must have four components')
            for v in values: finite(v,name)
        if min(*self.from_box[2:],*self.to_box[2:])<=0: raise ValueError('anchor sizes must be positive')
        if not any((*self.from_velocity,*self.to_velocity)):
            z=ease(p); box=tuple(a+(b-a)*z for a,b in zip(self.from_box,self.to_box))
        else:
            box=tuple((2*p**3-3*p*p+1)*a+(p**3-2*p*p+p)*duration*va+(-2*p**3+3*p*p)*b+(p**3-p*p)*duration*vb for a,b,va,vb in zip(self.from_box,self.to_box,self.from_velocity,self.to_velocity))
        if min(box[2:])<=0: raise ValueError('velocity caused nonpositive anchor size')
        return box

    def composite(self, frame, t, start, duration):
        x,y,w,h=self.box_at(t,start,duration)
        sprite=self.sprite.convert('RGBA').resize((max(1,round(w)),max(1,round(h))),Image.Resampling.LANCZOS)
        frame.alpha_composite(sprite,(round(x),round(y)))


_v4=None
def _v4_transition():
    global _v4
    if _v4 is None:
        spec=importlib.util.spec_from_file_location('_candidate_original_v4_transitions',Path(__file__).with_name('transitions.py'))
        _v4=importlib.util.module_from_spec(spec);spec.loader.exec_module(_v4)
    return _v4.transition


def transition_seconds(old,new,t,start,duration,*,kind='slide',direction='left',anchor=None,background='#FFFFFF',origin=(.5,.5),feather=.005,region=None):
    """Composite equal-sized PIL scenes with deterministic actual-second timing.

    slide is full-frame (region forbidden); direction is the old scene's exit.
    flip/radial optionally crop region=(left,top,right,bottom), v4 semantics.
    Region outside is the old frame: caller should draw persistent chrome later.
    Anchor is optional, one top-layer shared sprite; endpoint scene art must omit it.
    Other v4 effects not implicitly enabled; no audio handling or timeline scaling.
    """
    if old.size!=new.size: raise ValueError('scene sizes must match')
    p=progress_seconds(t,start,duration);z=ease(p)
    if kind not in ('slide','flip','radial'): raise ValueError('kind must be slide, flip or radial')
    a,b=old.convert('RGBA'),new.convert('RGBA')
    if kind=='slide':
        if region is not None: raise ValueError('horizontal slide is full-frame, not panel-only')
        if direction not in ('left','right'): raise ValueError('direction must be left or right')
        w,h=a.size;offset=round(w*z);sign=1 if direction=='left' else -1
        out=Image.new('RGBA',a.size,background)
        # Same rounded seam for both frames; never two independent positions.
        out.alpha_composite(a,(-sign*offset,0));out.alpha_composite(b,(sign*(w-offset),0))
    else:
        if region is None: out=_v4_transition()(a,b,z,kind=kind,origin=origin,feather=feather,background=background)
        else:
            if len(region)!=4 or any(isinstance(v,bool) or not isinstance(v,int) for v in region): raise ValueError('region requires four integer coordinates')
            l,u,r,d=region
            if not (0<=l<r<=a.width and 0<=u<d<=a.height): raise ValueError('region outside frame')
            out=a.copy()
            # Replace, rather than overlay, the region: transparent flip pixels must
            # erase outgoing art, not reveal a stale duplicate behind the turn.
            mixed=_v4_transition()(a.crop(region),b.crop(region),z,kind=kind,origin=origin,feather=feather,background=background)
            out.paste(mixed,(l,u))
    if anchor is not None: anchor.composite(out,t,start,duration)
    return out
