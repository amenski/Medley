import { Component, forwardRef, Inject, Input, NgZone } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { fromEvent, Observable, merge, of } from 'rxjs';

import { BaseEditor } from './base-editor.component';
import { NGX_MONACO_EDITOR_CONFIG, NgxMonacoEditorConfig } from './config';
import { NgxEditorModel } from './types';
import { LightTheme } from './light.theme';
import { MarkdownImproved } from './markdown-improved';

@Component({
    selector: 'ngx-monaco-editor',
    template: '<div class="editor-container" #editorContainer></div>',
    styles: [],
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => EditorComponent),
        multi: true
    }]
})
export class EditorComponent extends BaseEditor implements ControlValueAccessor {
    private _value: string = '';

    propagateChange = (_: any) => {};
    onTouched = () => {};

    @Input() resize$: Observable<void> = of();

    @Input('model')
    set model(model: NgxEditorModel) {
        this.options.model = model;
        if (this._editor) {
            this._editor.dispose();
            this.initMonaco(this.options);
        }
    }

    constructor(
        private zone: NgZone,
        @Inject(NGX_MONACO_EDITOR_CONFIG) private editorConfig: NgxMonacoEditorConfig) {
        super(editorConfig);
    }

    writeValue(value: any): void {
        this._value = value || '';
        // Fix for value change while dispose in process.
        setTimeout(() => {
            if (this._editor && !this.options.model) {
                this._editor.setValue(this._value);
            }
        });
    }

    registerOnChange(fn: any): void {
        this.propagateChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    protected initMonaco(options: any): void {
        const monaco = (<any>window).monaco;
        const hasModel = !!options.model;

        if (hasModel) {
            const model = monaco.editor.getModel(options.model.uri || '');
            if(model) {
                options.model = model;
                options.model.setValue(this._value);
            } else {
                options.model = monaco.editor.createModel(options.model.value, options.model.language, options.model.uri);
            }
        }

        monaco.editor.defineTheme('light-theme', LightTheme);
        monaco.editor.setTheme('light-theme');
        monaco.languages.register({ id: 'markdown-improved' });
        monaco.languages.setMonarchTokensProvider('markdown-improved', MarkdownImproved);

        this._editor = monaco.editor.create(this._editorContainer.nativeElement, options);

        if (!hasModel) {
            this._editor.setValue(this._value);
        }

        this._editor.onDidChangeModelContent((e: any) => {
            const value = this._editor.getValue();
            this.propagateChange(value);
            // value is not propagated to parent when executing outside zone.
            this.zone.run(() => this._value = value);
        });

        this._editor.onDidBlurEditorWidget(() => {
            this.onTouched();
        });

        // refresh layout on resize event.
        if (this._windowResizeSubscription) {
            this._windowResizeSubscription.unsubscribe();
        }

        this._windowResizeSubscription = merge(
            fromEvent(window, 'resize'),
            merge(this.resize$)
        ).subscribe(() => this._editor.layout());

        this.onInit.emit(this._editor);
    }
}