"use strict"

enum NetPBMFormat {
    P1 = "P1",
    P2 = "P2",
    P3 = "P3",
    P4 = "P4",
    P5 = "P5",
    P6 = "P6"
};

type Size = {
    x : number,
    y : number
};

class PPMCanvas {
    private cnv : HTMLCanvasElement|null;
    private ctx : CanvasRenderingContext2D|null;
    
    constructor( id:string, imagedata : string ){
        this.cnv = document.querySelector(id);
        this.ctx = this.cnv?.getContext("2d");
        const format = PPMCanvas.detect_format( imagedata );
        if ( format === NetPBMFormat.P1 ){
            // TODO
        }
        else {
            console.log("init")
            const numbers = PPMCanvas.process_ascii(imagedata);
            const image_size = {x : numbers[0], y : numbers[1]};
            const depth = numbers[2];
            this.render(format, image_size, depth, numbers.slice(3));
        }
    }

    private static process_ascii(ascii:string):number[] {
        return ascii.split("\n")
            .slice(1)
            .map( line => line.replace(/#.*/, ""))
            .join(" ")
            .split(" ")
            .filter( x => x.length > 0 )
            .map( x => parseInt(x) )
    }
    private render(
        format:NetPBMFormat,
        image_size : Size,
        depth : number,
        numbers : number[]
    ) : void {
        let newImageData = this.ctx.createImageData(image_size.x, image_size.y);
        for ( let y = 0; y < image_size.y; y++ ){
            for ( let x = 0; x < image_size.x; x++ ){
                let pnum = y*image_size.x + x
                if ( format === NetPBMFormat.P2 ){
                    newImageData.data[4*pnum+0] = numbers[pnum]/depth*0xff;
                    newImageData.data[4*pnum+1] = numbers[pnum]/depth*0xff;
                    newImageData.data[4*pnum+2] = numbers[pnum]/depth*0xff;
                }
                if ( format === NetPBMFormat.P3 ){
                    newImageData.data[4*pnum+0] = numbers[3*pnum+0]/depth*0xff;
                    newImageData.data[4*pnum+1] = numbers[3*pnum+1]/depth*0xff;
                    newImageData.data[4*pnum+2] = numbers[3*pnum+2]/depth*0xff;
                }
                newImageData.data[4*pnum+3] = 0xff;
            }
        }
        this.ctx.putImageData(newImageData, 0, 0)
    }
    private static detect_format( imagedata : string ) : NetPBMFormat {
        let MAGIC = imagedata.slice(0,2)
        if ( "P1,P2,P3".split(",").includes(MAGIC) ){
            return {
                "P1" : NetPBMFormat.P1,
                "P2" : NetPBMFormat.P2,
                "P3" : NetPBMFormat.P3
            }[MAGIC];
        }
    }

}


