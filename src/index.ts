'use strict';

enum NetPBMFormat {P1, P2, P3, P4, P5, P6};

type Size = {
    x: number,
    y: number
};

type TextCallback = ((arg0: string) => void);

class NetPBM {
    static parse(ascii: string): NetPBMImage {
        return new NetPBMImage(ascii);
    }

    static img(ascii: string): HTMLImageElement {
        return this.parse(ascii).toHTMLImage();
    }

    static canvas(ascii: string): HTMLCanvasElement {
        return this.parse(ascii).toHTMLCanvas();
    }

    static processAllImages(): void {
        document.querySelectorAll("img[netpbm-src]")
            .forEach(img => this.fetchImgNetPBMSrc(img as HTMLImageElement));
    }

    static processAllScriptsAndPre(): void {
        const mimetypes: string[] = [
            'image/x-portable-bitmap',
            'image/x-portable-graymap',
            'image/x-portable-pixmap'
        ];
        const allScriptsQueryStrings: string[] = mimetypes.map(m=>`script[type='${m}']`);
        const queryStr: string = [...allScriptsQueryStrings, 'pre[netpbm]'].join(", ");
        document.querySelectorAll(queryStr)
            .forEach(x => this.replaceElementWithRenderedImg(x as HTMLElement));
    }

    static processAll(): void {
        this.processAllImages();
        this.processAllScriptsAndPre();
    }

    static maybeQuerySelector(elemid:string|HTMLElement): HTMLElement {
        if (elemid instanceof HTMLElement){
            return elemid;
        }
        return document.querySelector(elemid as string);
    }

    static replaceElementWithRenderedImg(elemid:string|HTMLElement): void {
        const elem: HTMLElement = this.maybeQuerySelector(elemid);
        const img: HTMLImageElement = NetPBM.img(elem.textContent.trim());
        elem.parentElement.replaceChild(img, elem);
        // preserve original element's id= and class= by copying it into <img>
        img.id = elem.id;
        elem.classList.forEach(klass => img.classList.add(klass));
    }

    static fetchImgNetPBMSrc(elemid: string|HTMLImageElement): void {
        const elem: HTMLElement = this.maybeQuerySelector(elemid);
        fetch(elem.getAttribute("netpbm-src"))
            .then(resp => resp.text())
            .then(NetPBM.willUpdateImg(elem as HTMLImageElement));
    }

    static updateImg(ascii: string, elemid: string|HTMLImageElement): void {
        const elem: HTMLImageElement = this.maybeQuerySelector(elemid) as HTMLImageElement;
        elem.src = NetPBM.parse(ascii).toDataURL();
    }

    static createAndAppendImgTo(ascii: string, elemid: string|HTMLElement): void {
        const elem: HTMLElement = this.maybeQuerySelector(elemid);
        elem.append(NetPBM.img(ascii));
    }

    static willAppendImgTo(elemid: string|HTMLElement): TextCallback {
        return (text: string): void => {
            this.createAndAppendImgTo(text, elemid);
        };
    }

    static willUpdateImg(elemid: string|HTMLImageElement): TextCallback {
        return (text: string): void => {
            this.updateImg(text, elemid);
        };
    }
}

class NetPBMImage {
    private imageData: ImageData;

    constructor(ascii: string){
        const format = NetPBMImage.detect_format(ascii);
        let depth: number;
        let numbers: number[];
        let image_size: Size;
        let hdrsize: number;
        switch(format){
            case NetPBMFormat.P1:
                numbers = NetPBMImage.process_ascii_P1(ascii);
                image_size = {x: numbers[0], y: numbers[1]};
                hdrsize = 2;
                break;
            case NetPBMFormat.P2:
            case NetPBMFormat.P3:
                numbers = NetPBMImage.process_ascii(ascii);
                image_size = {x: numbers[0], y: numbers[1]};
                depth = numbers[2];
                hdrsize = 3;
                break;
        }
        this.imageData = this.render(format, image_size, depth, numbers.slice(hdrsize));
    }

    private static get_tokens_from_ascii(ascii: string): string[] {
        return ascii
            .slice(2)                               // skip magic header ("P1","P2",etc)
            .split("\n")                            // split into lines
            .map( line => line.replace(/#.*/, ""))  // remove comments until the end of line
            .join(" ")                              // make one long line
            .split(" ")                             // split into tokens
            .filter(x => x.length > 0)              // skip empty tokens
    }

    private static process_ascii(ascii: string): number[] {
        return this
            .get_tokens_from_ascii(ascii)
            .map(x => parseInt(x));
    }

    private static process_ascii_P1(ascii: string): number[] {
        // P1 uses only 0 and 1 in image data, no whitespaces are required
        const tokens: string[] = this.get_tokens_from_ascii(ascii);
        const dimensions: number[] = tokens
            .slice(0, 2)
            .map(x=>parseInt(x));
        const numbers: number[] = tokens
            .slice(2)                       // skip size
            .join("")                       // join all tokens
            .split("")                      // split characters
            .map(x=>parseInt(x));
        return [... dimensions, ...numbers];
    }

    private static detect_format(imagedata: string): NetPBMFormat {
        const magicSize: number = 2;
        const magic: string = imagedata.slice(0, magicSize);
        const MAGICS: object = {
            "P1": NetPBMFormat.P1,
            "P2": NetPBMFormat.P2,
            "P3": NetPBMFormat.P3
        };
        if ( magic in MAGICS ){
            return MAGICS[magic];
        }
        else {
            throw Error(`Unsupported NetPBM format: ${magic}`);
        }
    }

    public render(
        format: NetPBMFormat,
        image_size: Size,
        depth: number,
        numbers: number[]
    ): ImageData
    {    
        const newImageData: ImageData = new ImageData(image_size.x, image_size.y);
        for (let y: number = 0; y < image_size.y; y++){
            for (let x: number = 0; x < image_size.x; x++){
                const pnum: number = y*image_size.x + x; // pixel number (offset)
                const numbersPerPixel: number = ({
                    [NetPBMFormat.P1]: 1,
                    [NetPBMFormat.P2]: 1,
                    [NetPBMFormat.P3]: 3
                })[format];
                switch( format ){
                    case NetPBMFormat.P1:
                        for (let i: number = 0; i<3; i++){
                            newImageData.data[4*pnum+i] = 0xff - numbers[numbersPerPixel*pnum] * 0xff;
                        }
                        break;
                    case NetPBMFormat.P2:
                    case NetPBMFormat.P3:
                        for (let i: number = 0; i<3; i++){
                            newImageData.data[4*pnum+i] = numbers[numbersPerPixel*pnum + i%numbersPerPixel]/depth * 0xff;
                        }
                        break;
                }
                newImageData.data[4*pnum+3] = 0xff; // alpha channel -> no transparency
            }
        }
        return newImageData;
    }
    public toDataURL(format?: string): string {
        return this.toHTMLCanvas().toDataURL(format);
    }

    public toHTMLImage(format?: string): HTMLImageElement {
        const img: HTMLImageElement = document.createElement("img") as HTMLImageElement;
        this.updateImage(img, format);
        return img;
    }

    public toHTMLCanvas(): HTMLCanvasElement {
        const cnv: HTMLCanvasElement = document.createElement("canvas") as HTMLCanvasElement;
        cnv.width = this.imageData.width;
        cnv.height = this.imageData.height;
        this.putOnCanvas(cnv, 0, 0);
        return cnv;
    }

    public putOnCanvas(canvas: HTMLCanvasElement, x: number, y: number): void {
        canvas.getContext("2d").putImageData(this.imageData, x, y);
    }

    public updateImage(img: HTMLImageElement, format?: string): void {
        img.src = this.toDataURL(format);
    }

}

window.addEventListener("load", function(): void {
    NetPBM.processAll();
} );
