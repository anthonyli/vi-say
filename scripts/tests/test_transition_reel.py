# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
import sys
from pathlib import Path
import unittest
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from check_transition_reel import compare_frames,compare_transition_samples


class TransitionReelRegression(unittest.TestCase):
    def test_an_outgoing_image_covering_the_transition_is_a_failure(self):
        a=Image.new('RGB',(32,32),'#0c254f');b=Image.new('RGB',(32,32),'#ffd7a0')
        self.assertFalse(compare_frames(a,a,a,b,b)['passed'])

    def test_a_real_blend_with_clean_endpoints_passes(self):
        a=Image.new('RGB',(32,32),'#0c254f');b=Image.new('RGB',(32,32),'#ffd7a0')
        self.assertTrue(compare_frames(a,a,Image.blend(a,b,.5),b,b)['passed'])

    def test_a_scene_that_never_settles_at_the_incoming_frame_fails(self):
        a=Image.new('RGB',(32,32),'#0c254f');b=Image.new('RGB',(32,32),'#ffd7a0')
        self.assertFalse(compare_frames(a,a,Image.blend(a,b,.5),a,b)['passed'])

    def test_an_early_reveal_is_checked_at_its_visible_phase(self):
        a=Image.new('RGB',(32,32),'#0c254f');b=Image.new('RGB',(32,32),'#ffd7a0')
        result=compare_transition_samples(a,a,[Image.blend(a,b,.5),b,b],b,b)
        self.assertTrue(result['passed'])
        self.assertEqual(result['selectedInteriorFraction'],.25)
        self.assertFalse(compare_transition_samples(a,a,[a,a,a],b,b)['passed'])


if __name__=='__main__':unittest.main()
