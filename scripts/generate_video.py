#!/usr/bin/env python3
"""
Generate a presentation video from exported slide images.
Each slide is shown for a configurable duration with smooth cross-fade transitions.
Output: 1920x1080 MP4 (H.264) video.
"""

import cv2
import numpy as np
import glob
import os

SLIDE_DIR = os.path.join(os.path.dirname(__file__), "_slide_images")
OUTPUT    = os.path.join(os.path.dirname(__file__), "..", "SustainabilitySignals_10slides.mp4")

# Timing (seconds)
SLIDE_DURATION  = 6.0   # How long each slide is shown (including fade time)
FADE_DURATION   = 0.8   # Cross-fade transition between slides
FIRST_SLIDE_EXTRA = 2.0 # Extra time on the title slide
LAST_SLIDE_EXTRA  = 2.0 # Extra time on the closing slide
FPS = 30                 # Frames per second

# Video dimensions
WIDTH  = 1920
HEIGHT = 1080


def load_slides():
    """Load slide images sorted by filename."""
    pattern = os.path.join(SLIDE_DIR, "slide_*.png")
    paths = sorted(glob.glob(pattern))
    if not paths:
        raise FileNotFoundError(f"No slide images found in {SLIDE_DIR}")
    
    slides = []
    for p in paths:
        img = cv2.imread(p)
        if img is None:
            print(f"  WARNING: Could not read {p}, skipping")
            continue
        # Resize to target dimensions if needed
        if img.shape[1] != WIDTH or img.shape[0] != HEIGHT:
            img = cv2.resize(img, (WIDTH, HEIGHT), interpolation=cv2.INTER_LANCZOS4)
        slides.append(img)
        print(f"  Loaded: {os.path.basename(p)} ({img.shape[1]}x{img.shape[0]})")
    
    return slides


def cross_fade(img_a, img_b, alpha):
    """Blend two images: result = (1-alpha)*A + alpha*B."""
    return cv2.addWeighted(img_a, 1.0 - alpha, img_b, alpha, 0)


def build_video(slides):
    """Assemble slides into an MP4 video with cross-fade transitions."""
    out_path = os.path.abspath(OUTPUT)
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(out_path, fourcc, FPS, (WIDTH, HEIGHT))
    
    if not writer.isOpened():
        raise RuntimeError(f"Could not open video writer for {out_path}")
    
    total_frames = 0
    n = len(slides)
    
    for i, slide in enumerate(slides):
        # Determine hold duration for this slide
        hold = SLIDE_DURATION
        if i == 0:
            hold += FIRST_SLIDE_EXTRA
        if i == n - 1:
            hold += LAST_SLIDE_EXTRA
        
        # Static hold frames (minus fade-out time, except for last slide)
        if i < n - 1:
            static_time = hold - FADE_DURATION
        else:
            static_time = hold
        
        static_frames = int(static_time * FPS)
        
        # Write static frames
        for _ in range(static_frames):
            writer.write(slide)
            total_frames += 1
        
        # Cross-fade to next slide (except after last slide)
        if i < n - 1:
            fade_frames = int(FADE_DURATION * FPS)
            next_slide = slides[i + 1]
            for f in range(fade_frames):
                alpha = (f + 1) / fade_frames
                blended = cross_fade(slide, next_slide, alpha)
                writer.write(blended)
                total_frames += 1
        
        print(f"  Slide {i+1}/{n}: {static_frames} static + "
              f"{int(FADE_DURATION * FPS) if i < n-1 else 0} fade frames")
    
    # Final fade to black
    fade_out_frames = int(1.5 * FPS)
    black = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    for f in range(fade_out_frames):
        alpha = (f + 1) / fade_out_frames
        blended = cross_fade(slides[-1], black, alpha)
        writer.write(blended)
        total_frames += 1
    
    # Hold black for 1 second
    for _ in range(FPS):
        writer.write(black)
        total_frames += 1
    
    writer.release()
    
    duration = total_frames / FPS
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"\nVideo saved: {out_path}")
    print(f"  Resolution: {WIDTH}x{HEIGHT}")
    print(f"  FPS: {FPS}")
    print(f"  Total frames: {total_frames}")
    print(f"  Duration: {duration:.1f}s ({duration/60:.1f} min)")
    print(f"  File size: {size_mb:.1f} MB")
    
    return out_path


def main():
    print("Loading slide images...")
    slides = load_slides()
    print(f"\nLoaded {len(slides)} slides")
    
    print(f"\nBuilding video ({SLIDE_DURATION}s per slide, {FADE_DURATION}s fades)...")
    path = build_video(slides)
    
    print("\nDone!")


if __name__ == "__main__":
    main()
