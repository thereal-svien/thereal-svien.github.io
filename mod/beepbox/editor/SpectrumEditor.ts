// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import {Config} from "../synth/SynthConfig.js";
import {prettyNumber} from "./EditorConfig.js";
import {ColorConfig} from "./ColorConfig.js";
import {SpectrumWave, Instrument} from "../synth/synth.js";
import {SongDocument} from "./SongDocument.js";
import {HTML, SVG} from "imperative-html/dist/esm/elements-strict.js";
import {EasyPointers, Point2d} from "./EasyPointers.js";
import {ChangeSpectrum} from "./changes.js";

export class SpectrumEditor {
	private readonly _editorWidth: number = 120;
	private readonly _editorHeight: number = 26;
	private readonly _fill: SVGPathElement = SVG.path({fill: ColorConfig.uiWidgetBackground, "pointer-events": "none"});
	private readonly _octaves: SVGSVGElement = SVG.svg({"pointer-events": "none"});
	private readonly _fifths: SVGSVGElement = SVG.svg({"pointer-events": "none"});
	private readonly _curve: SVGPathElement = SVG.path({fill: "none", stroke: "currentColor", "stroke-width": 2, "pointer-events": "none"});
	private readonly _arrow: SVGPathElement = SVG.path({fill: "currentColor", "pointer-events": "none"});
	private readonly _svg: SVGSVGElement = SVG.svg({style: `background-color: ${ColorConfig.editorBackground};`, width: "100%", height: "100%", viewBox: "0 0 "+this._editorWidth+" "+this._editorHeight, preserveAspectRatio: "none"},
		this._fill,
		this._octaves,
		this._fifths,
		this._curve,
		this._arrow,
	);
	
	public readonly container: HTMLElement = HTML.div({class: "spectrum", style: "height: 100%; touch-action: none; cursor: crosshair;"}, this._svg);
	
	private _mouseX: number = 0;
	private _mouseY: number = 0;
	private _freqPrev: number = 0;
	private _ampPrev: number = 0;
	private _change: ChangeSpectrum | null = null;
	private _renderedPath: String = "";
	private _renderedFifths: boolean = true;
	
	constructor(private _doc: SongDocument, private _spectrumIndex: number | null) {
		for (let i: number = 0; i < Config.spectrumControlPoints; i += Config.spectrumControlPointsPerOctave) {
			this._octaves.appendChild(SVG.rect({fill: ColorConfig.tonic, x: (i+1) * this._editorWidth / (Config.spectrumControlPoints + 2) - 1, y: 0, width: 2, height: this._editorHeight}));
		}
		for (let i: number = 4; i <= Config.spectrumControlPoints; i += Config.spectrumControlPointsPerOctave) {
			this._fifths.appendChild(SVG.rect({fill: ColorConfig.fifthNote, x: (i+1) * this._editorWidth / (Config.spectrumControlPoints + 2) - 1, y: 0, width: 2, height: this._editorHeight}));
		}
		
		new EasyPointers(this.container, {preventTouchGestureScrolling: true});
		//this.container.addEventListener("pointerenter", this._onPointerMove);
		//this.container.addEventListener("pointerleave", this._onPointerLeave);
		this.container.addEventListener("pointerdown", this._onPointerDown);
		this.container.addEventListener("pointermove", this._onPointerMove);
		this.container.addEventListener("pointerup", this._onPointerUp);
		this.container.addEventListener("pointercancel", this._onPointerUp);
	}
	
	private _xToFreq(x: number): number {
		return (Config.spectrumControlPoints + 2) * x / this._editorWidth - 1;
	}
	
	private _yToAmp(y: number): number {
		return Config.spectrumMax * (1 - (y - 1) / (this._editorHeight - 2));
	}
	
	private _updateMousePos(event: PointerEvent): void {
		const point: Point2d = event.pointer!.getPointInNormalized(this.container);
		this._mouseX = point.x * this._editorWidth;
		this._mouseY = point.y * this._editorHeight;
	}
	
	private _onPointerDown = (event: PointerEvent): void => {
		this._updateMousePos(event);
		this._freqPrev = this._xToFreq(this._mouseX);
		this._ampPrev = this._yToAmp(this._mouseY);
		this._whenCursorMoved(event);
	}
	
	private _onPointerMove = (event: PointerEvent): void => {
		this._updateMousePos(event);
		this._whenCursorMoved(event);
	}
	
	private _whenCursorMoved(event: PointerEvent): void {
		if (event.pointer!.isDown) {
			const freq: number = this._xToFreq(this._mouseX);
			const amp: number = this._yToAmp(this._mouseY);
			
			const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
			const spectrumWave: SpectrumWave = (this._spectrumIndex == null) ? instrument.spectrumWave : instrument.drumsetSpectrumWaves[this._spectrumIndex];
			
			if (freq != this._freqPrev) {
				const slope: number = (amp - this._ampPrev) / (freq - this._freqPrev);
				const offset: number = this._ampPrev - this._freqPrev * slope;
				const lowerFreq: number = Math.ceil(Math.min(this._freqPrev, freq));
				const upperFreq: number = Math.floor(Math.max(this._freqPrev, freq));
				for (let i: number = lowerFreq; i <= upperFreq; i++) {
					if (i < 0 || i >= Config.spectrumControlPoints) continue;
					spectrumWave.spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(i * slope + offset)));
				}
			}
			
			spectrumWave.spectrum[Math.max(0, Math.min(Config.spectrumControlPoints - 1, Math.round(freq)))] = Math.max(0, Math.min(Config.spectrumMax, Math.round(amp)));
			
			this._freqPrev = freq;
			this._ampPrev = amp;
			
			this._change = new ChangeSpectrum(this._doc, instrument, spectrumWave);
			this._doc.setProspectiveChange(this._change);
		}
	}
	
	private _onPointerUp = (event: PointerEvent): void => {
		this._doc.record(this._change!);
		this._change = null;
	}
	
	public render(): void {
		const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
		const spectrumWave: SpectrumWave = (this._spectrumIndex == null) ? instrument.spectrumWave : instrument.drumsetSpectrumWaves[this._spectrumIndex];
		const controlPointToHeight = (point: number): number => {
			return (1 - (point / Config.spectrumMax)) * (this._editorHeight - 1) + 1;
		}
		
		let lastValue: number = 0;
		let path: string = "M 0 " + prettyNumber(this._editorHeight) + " ";
		for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
			let nextValue: number = spectrumWave.spectrum[i];
			if (lastValue != 0 || nextValue != 0) {
				path += "L ";
			} else {
				path += "M ";
			}
			path += prettyNumber((i + 1) * this._editorWidth / (Config.spectrumControlPoints + 2)) + " " + prettyNumber(controlPointToHeight(nextValue)) + " ";
			lastValue = nextValue;
		}
		
		const lastHeight: number = controlPointToHeight(lastValue);
		if (lastValue > 0) {
			path += "L " + (this._editorWidth - 1) + " " + prettyNumber(lastHeight) + " ";
		}
		
		if (this._renderedPath != path) {
			this._renderedPath = path;
			this._curve.setAttribute("d", path);
			this._fill.setAttribute("d", path + "L " + this._editorWidth + " " + prettyNumber(lastHeight) + " L " + this._editorWidth + " " + prettyNumber(this._editorHeight) + " L 0 " + prettyNumber(this._editorHeight) + " z ");
			
			this._arrow.setAttribute("d", "M " + this._editorWidth + " " + prettyNumber(lastHeight) + " L " + (this._editorWidth - 4) + " " + prettyNumber(lastHeight - 4) + " L " + (this._editorWidth - 4) + " " + prettyNumber(lastHeight + 4) + " z");
			this._arrow.style.display = (lastValue > 0) ? "" : "none";
		}
		if (this._renderedFifths != this._doc.prefs.showFifth) {
			this._renderedFifths = this._doc.prefs.showFifth;
			this._fifths.style.display = this._doc.prefs.showFifth ? "" : "none";
		}
	}
}
