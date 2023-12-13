/* 
    arthouse.js
    
    JavaScript library for scripted animations build on html, css and javascript.
    
    Copyright (C) 2023 - present: Stephan Cieszynski

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

class ArtHouse {

    constructor(root) {
        this.root = root ?? document.body;
    }

    get animations() { return this.root.getAnimations({ subtree: true }) }

    // function play(dur, start) 
    play(dur, start) {
        console.assert(!isNaN(dur), '<dur> has to be a number');
        console.assert(0 <= ~~dur, '<dur> has to be a positive number');

        // find animation by label to get delay as starttime 
        if (typeof start === 'string') {
            start = this.animations
                .find((animation) => animation.id === start)
                ?.effect.getComputedTiming()
                .delay;
        }

        // helper to synchronize all animations              
        let currentTime = 0;

        return Promise
            // ensure all animations are ready
            .all(this.animations.map((animation) => animation.ready))
            .then((animations) => {
                animations.forEach((animation) => {
                    // synchronize and seek
                    currentTime = animation.currentTime = start ?? animation.currentTime;
                    animation.play();
                });

                return Promise.resolve(
                    document.body
                        .animate([], { duration: Math.abs(dur) })
                        .finished.then((e) => {
                            // set currentTime to the exact value
                            currentTime += dur;
                            animations.forEach((animation) => {
                                animation.pause();
                                // synchronize currentTime
                                animation.currentTime = currentTime;
                            });
                            return currentTime;
                        }));
            });
    }

    // function tween(element, ...args) 
    tween(element, ...args) {
        console.assert(element instanceof HTMLElement, `${element} is not instanceof HTMLElement`);
        console.assert(this.root.contains(element), `element is not a descendant of ${this.root}`);

        const tweens = args.pop();
        const pseudoElement = args.pop();   // could be null

        const options = { duration: 0, pseudoElement: pseudoElement, fill: 'forwards' };
        const keyFrames = [];

        Object
            .entries(tweens)
            // sort in descending order to obtain
            // the highest time value for calculating the duration
            .sort(([keyA, ObjA], [keyB, objB]) => { return keyB - keyA })
            .forEach(([timeOrOpts, data], idx) => {
                // distinct between times and options
                if (isNaN(timeOrOpts)) {
                    options[timeOrOpts] = data;
                } else {
                    // idx==0: the first entry give the highest
                    // time value for calculating the duration
                    if (!idx) { options.duration = timeOrOpts * 1; }

                    // calculate offset relative by time / duration
                    data.offset = timeOrOpts / options.duration;
                    keyFrames.push(data);
                }
            });

        // sort keyframes by offset in ascending order,
        // otherwise creating KeyframeEffect raises an error
        keyFrames.sort((a, b) => a.offset - b.offset);

        const keyframeEffect = new KeyframeEffect(element, keyFrames, options);
        const animation = new Animation(keyframeEffect);
        animation.pause();

        return animation;
    }

    // function group(time, ...args)
    group(time, ...args) {
        console.assert(!isNaN(time));
        console.assert(args.every((arg) => ['Array', 'Animation'].includes(arg.constructor.name)));

        const animations = []

        for (const arrOrAnim of args) {
            switch (arrOrAnim.constructor.name) {
                case 'Array':
                    arrOrAnim.forEach((anim) => {
                        const timing = anim.effect.getComputedTiming();
                        timing.delay += time;
                        anim.effect.updateTiming(timing);
                        animations.push(anim);
                    });
                    break;
                case 'Animation':
                    const timing = arrOrAnim.effect.getComputedTiming();
                    timing.delay += time;
                    arrOrAnim.effect.updateTiming(timing);
                    animations.push(arrOrAnim);
                    break;
            }
        }

        return animations;
    }

    // function sequence(time, ...args)
    sequence(time, ...args) {
        console.assert(!isNaN(time));
        console.assert(args.every((arg) => ['Array', 'Animation', 'String'].includes(arg.constructor.name)));

        const animations = []
        let label = null;

        for (const arrOrAnimOrStr of args) {
            switch (arrOrAnimOrStr.constructor.name) {
                case 'String':
                    // set id of next animation with this label
                    label = arrOrAnimOrStr;
                    break;

                case 'Array':
                    let duration = 0;

                    arrOrAnimOrStr.forEach((anim) => {
                        const timing = anim.effect.getComputedTiming();
                        timing.delay += time;
                        duration = Math.max(duration, timing.duration);
                        anim.effect.updateTiming(timing);
                        anim.id = label;
                        label = null;

                        animations.push(anim);
                    });

                    time += duration;
                    break;

                case 'Animation':
                    const timing = arrOrAnimOrStr.effect.getComputedTiming();
                    timing.delay += time;
                    time += timing.duration;
                    arrOrAnimOrStr.effect.updateTiming(timing);
                    arrOrAnimOrStr.id = label;
                    label = null;

                    animations.push(arrOrAnimOrStr);
                    break;
            }
        }

        return animations;
    }
}