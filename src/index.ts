'use strict';

enum NetPBMFormat {P1, P2, P3, P4, P5, P6};

type Size = {
    x: number,
    y: number
};

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
        document
            .querySelectorAll("img[netpbm-src]")
            .forEach(img => {
                fetch(img.getAttribute("netpbm-src"))
                    .then(resp => resp.text())
                    .then(text => NetPBM.parse(text).updateImage(img as HTMLImageElement))
            });
    }
    static processAllScriptsAndPre(): void {
        const mimetypes: string[] = [
            'image/x-portable-bitmap',
            'image/x-portable-graymap',
            'image/x-portable-pixmap'
        ];
        document
            .querySelectorAll(
                [
                    ...mimetypes.map(m=>`script[type='${m}']`),
                    'pre[netpbm]'
                ].join(", ")
            )
            .forEach(x => {
                const img: HTMLImageElement = NetPBM.parse(x.textContent.trim()).toHTMLImage()
                x.parentElement.replaceChild(img, x);
                // preserve original element's id= and class= by copying it into <img>
                img.id = x.id;
                x.classList.forEach(klass => img.classList.add(klass));
            });
    }

    static processAll(): void {
        this.processAllImages();
        this.processAllScriptsAndPre();
    }
}

class NetPBMImage {
    private imageData: ImageData;

    constructor(ppmascii: string){
        const format = NetPBMImage.detect_format(ppmascii);
        let depth: number;
        let numbers: number[];
        let image_size: Size;
        let hdrsize: number;
        switch(format){
            case NetPBMFormat.P1:
                numbers = NetPBMImage.process_ascii_P1(ppmascii);
                image_size = {x: numbers[0], y: numbers[1]};
                hdrsize = 2;
                break;
            case NetPBMFormat.P2:
            case NetPBMFormat.P3:
                numbers = NetPBMImage.process_ascii(ppmascii);
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
        const magic = imagedata.slice(0,2);
        const MAGICS = {
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
        const newImageData = new ImageData(image_size.x, image_size.y);
        for (let y = 0; y < image_size.y; y++){
            for (let x = 0; x < image_size.x; x++){
                const pnum = y*image_size.x + x; // pixel number (offset)
                const numbersPerPixel:number = ({
                    [NetPBMFormat.P1]: 1,
                    [NetPBMFormat.P2]: 1,
                    [NetPBMFormat.P3]: 3
                })[format];
                switch( format ){
                    case NetPBMFormat.P1:
                        for (let i=0; i<3; i++){
                            newImageData.data[4*pnum+i] = 0xff - numbers[numbersPerPixel*pnum] * 0xff;
                        }
                        break;
                    case NetPBMFormat.P2:
                    case NetPBMFormat.P3:
                        for (let i=0; i<3; i++){
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
        const img = document.createElement("img");
        this.updateImage(img, format);
        return img;
    }

    public toHTMLCanvas(): HTMLCanvasElement {
        const cnv = document.createElement("canvas");
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
