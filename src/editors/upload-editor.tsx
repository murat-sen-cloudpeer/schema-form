import React, { useState, useReducer, useContext } from 'react';
import { ISchemaComponentProps } from "components/schema-form-interfaces";
import { ValueDispatch, ValueAction } from "components/schema-form-value-context";
import { useDropzone } from "react-dropzone";
import { SchemaFormComponentWrapper } from "components/schema-form-component";
import _ from "lodash";

export interface IUploadEditorContext {
    getFileUrl(file: File, path: string[], schema: object): string;
    sendFile(url: string, file: File, progress: (pc: number) => void): Promise<void>;
    deleteFile?(url: string): Promise<void>;
    saveSiteRelative: boolean;
}

export function sendFileAsBody(url: string, file: File, progress: (pc: number) => void, method: string = "POST") {
    return new Promise<void>((resolve, reject) => {
        try {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (ev: ProgressEvent) => progress(ev.loaded / ev.total * 100.0);
            xhr.upload.onloadend = (ev: ProgressEvent) => {
                progress(xhr.status === 200 || xhr.status === 0 ? -1 : -xhr.status);
                resolve();
            }
            xhr.withCredentials = true;
            xhr.open(method, url);
            xhr.send(file);
        } catch(err) {
            reject(err);
        }
    });
}

export const imageSpec = { extensions: [ 'jpg', 'gif', 'png', 'svg' ] };

interface IProgressBarProps {
    filename: string;
    pc: number;
}
function ProgressBar({ pc, filename }: IProgressBarProps) {
    return (
        <div className="sf-progress">
            <div className="sf-progress-indicator" style={{ width: `${pc}%` }}></div>
            <span className="sf-progress-name">{filename}</span>
        </div>
    );
}

function progressBarsReducer(state: { [key: string]: number }, action: [ string, number ]) {
    const [ filename, progress ] = action;
    if (progress < 0) {
        delete state[filename];
        return state;
    } else {
        return { ...state, [filename]: progress }
    }
}

function uploadedReducer(state: string[], action: string) {
    return [ ...state, action ];
}

function makeSiteRelative(url: string): string {
    return url.replace(/^http(s)?:\/\/[^/]+\//, '/');
}

function makeAbsolute(url: string, host: string): string {
    return (url.startsWith('/') ? host : '') + url
}

function getHost(url: string): string {
    var match = url.match(/^http(s)?:\/\/[^/]+\//);
    return match ? match[0].slice(0, -1) : '';
}

export function UploadEditor(props: ISchemaComponentProps) {
    const { context, schema, path, value, errors, onFocus, onBlur } = props;
    const isMulti = schema['editor'].toLowerCase().indexOf('multi') >= 0;
    const uploadMsg = "Drag files here or click to select";
    const uploadContext = (context || {}) as IUploadEditorContext;
    const [ progressBars, dispatchProgressBars ] = useReducer(progressBarsReducer, {});
    const dispatch = useContext(ValueDispatch);

    const updateProgress = (file: File, pc: number) => {
        dispatchProgressBars([ file.name, pc ]);
    }

    const onDrop = (acceptedFiles: File[]) => {
        if (!isMulti) {
            acceptedFiles = [ acceptedFiles[0] ];
        }
        const sendFilePromises = acceptedFiles.map(file => {
            const absUrl = uploadContext.getFileUrl(file, path, schema).toLowerCase();
            return uploadContext.sendFile(absUrl, file, (pc) => updateProgress(file, pc))
                .then(() => encodeURI(absUrl));
        });
        Promise.all(sendFilePromises)
            .then((absUrls) => {
                let saveUrls = absUrls.map(absUrl => uploadContext.saveSiteRelative ? makeSiteRelative(absUrl) : absUrl);
                if (isMulti) {
                    saveUrls = _.union(value ? value.split('|') : [], saveUrls);
                } else if (value && value.length > 0 && uploadContext.deleteFile) {
                    let absUrl = makeAbsolute(value.split('|')[0], imageHost);
                    uploadContext.deleteFile(absUrl); // fire and forget delete request
                }
                dispatch(ValueAction.set(path, saveUrls.join('|')))
            }); // vbar character not allowed in urls unencoded
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const onDelete = (absUrl: string) => () => {
        uploadContext.deleteFile && uploadContext.deleteFile(absUrl);
        dispatch(ValueAction.set(path, (value || '').split('|')
            .filter((v: string) => makeAbsolute(v, imageHost) !== absUrl).join('|'))
        );
    };

    const urls = value ? (value as string).split('|') : [];
    const getExtn = (url: string) => _.last(url.toLowerCase().split('.')) || '';

    const imageHost = uploadContext.saveSiteRelative
        ? getHost(uploadContext.getFileUrl(new File([], ''), path, schema))
        : '';

    const images = (urls: string[]) => {
        const imageUrls = urls.filter(url => imageSpec.extensions.indexOf(getExtn(url)) >= 0)
            .map(url => makeAbsolute(url, imageHost));
        const fileUrls = urls.filter(url => imageSpec.extensions.indexOf(getExtn(url)) < 0);
        return (
        <div className="sf-image-container">
            {imageUrls.map((absUrl) =>
                <div className="sf-upload-container" key={absUrl}>
                    <div className="sf-upload-item sf-image-crop">
                        <img className="sf-upload-image" src={absUrl}/>
                    </div>
                    <div className="sf-upload-delete" onMouseDown={onDelete(absUrl)}>x</div>
                </div>
            )}
            {fileUrls.map((url) =>
                <div className="sf-upload-container" key={url}>
                    <div className="sf-upload-item sf-file-crop" key={url} title={url}>
                        {getExtn(url)}
                    </div>
                    <div className="sf-upload-delete" onMouseDown={onDelete(makeAbsolute(url, imageHost))}>x</div>
                </div>
            )}
        </div>
        );
    }

    return (
        <SchemaFormComponentWrapper {...props}>
            <div className={`sf-control sf-upload ${isDragActive ? "sf-drag-over" : ""} ${progressBars.length ? "sf-uploading" : ""}`}>
                <div className='sf-upload-row'>
                    {urls.length > 0 && images(urls)}
                    <div {...getRootProps()}>
                        <input {...getInputProps()} />
                        <p className='sf-upload-message'>{uploadMsg}</p>
                    </div>
                </div>
                {Object.keys(progressBars).map(name => 
                    <ProgressBar pc={progressBars[name]} filename={name} key={name}/>
                )}
            </div>
        </SchemaFormComponentWrapper>
    );
}