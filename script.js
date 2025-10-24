//DOM SELECTIONS------------------------------------------------------------------------------------------------------------------------------------------------------------

// Select elements for file upload zone and thumbnail display
const dropZone = document.querySelector("html");
const fileZone = document.querySelector("#upload-files");
const thumbnailDiv = document.querySelector("#thumbnails");
let fileList = []; // Array to keep track of validated files
let browserZoomLevel = getBrowserZoomLevel();

const menuBtnDiv = document.querySelector("#toggle-menu-button");
const menuBtn = document.querySelector("#toggle-menu-button img");
const trashBtn = document.querySelector("#trash-btn");
const restartBtn = document.querySelector("#delete-all-btn");
const coverCb = document.querySelector("#toggle-cover-chbx");
const templateCb = document.querySelector("#toggle-template-chbx");
const boundingboxCb = document.querySelector("#toggle-boundingbx-chbx");
const bgColorCb = document.querySelector("#toggle-bg-color");
const bgColorPicker = document.querySelector("#bg-color-picker");
const templateSelector = document.querySelector("#select-template");
const opaqueCb = document.querySelector("#toggle-opaque-chbx");
const scaleControls = document.querySelector("#scale-controls");
const startMessage = document.querySelector("#get-started");



//EVENT LISTENERS------------------------------------------------------------------------------------------------------------------------------------------------------------

//listens for zooming
window.addEventListener("resize", adjustChequeredSize);

// Event listener for drag-and-drop functionality
dropZone.addEventListener("dragover", (e) => {e.preventDefault();}); // Prevent default behavior to allow drop

dropZone.addEventListener("drop", dropHandler);

// Event listener for file selection via input field
fileZone.addEventListener("change", (e) => {addFiles(fileZone.files);});

// Event listener for extending the side menu
menuBtn.addEventListener("click", toggleMenu);

// Event listener for The trash button
trashBtn.addEventListener("click", trashFiles);

// Event listener for the start over button
restartBtn.addEventListener("click", startOver);

coverCb.addEventListener("change", toggleCover);

templateCb.addEventListener("change", toggleTemplate);

bgColorPicker.addEventListener("input", changeBgColor);

bgColorCb.addEventListener("change", applyBackground);

templateSelector.addEventListener("change", function(e){
    const chbx = document.querySelector("#toggle-template-chbx");
  
    changeTemplate();
    chbx.checked = true;

});

opaqueCb.addEventListener("change", function (e){
    let isRedOverlayActive;

    isRedOverlayActive = !isRedOverlayActive;
    if (this.checked){
        isRedOverlayActive = true;
    } else {
        isRedOverlayActive = false;
    }

    const largeDisplay = document.querySelector("#large-display");
    const canvases = largeDisplay.querySelectorAll("canvas");

    canvases.forEach((canvas) => {
        const ctx = canvas.getContext("2d");
        if (canvas.parentElement.querySelector(".opaqueFilter") != null){
            if (isRedOverlayActive){
                canvas.parentElement.querySelector(".opaqueFilter").classList.remove("hidden");

            } else{
                canvas.parentElement.querySelector(".opaqueFilter").classList.add("hidden");
            }
        } else {
            applyRedOverlay(ctx, canvas);
        }
    });
});

boundingboxCb.addEventListener("change", function (e){
    let isBoundingActive;

    isBoundingActive = !isBoundingActive;
    if (this.checked){
        isBoundingActive = true;
    } else {
        isBoundingActive = false;
    }

    const largeDisplay = document.querySelector("#large-display");
    const canvases = largeDisplay.querySelectorAll("canvas");

    canvases.forEach((canvas) => {
        const ctx = canvas.getContext("2d");
        if (canvas.parentElement.querySelector(".boundingBox") != null){
            if (isBoundingActive){
                canvas.parentElement.querySelector(".boundingBox").classList.remove("hidden");

            } else{
                canvas.parentElement.querySelector(".boundingBox").classList.add("hidden");
            }
        } else {
            drawBoundingBox(ctx, canvas);
        }
    });
});

scaleControls.addEventListener("click", scaleItems);

function scaleItems(e) {
    const btn = e.target.closest("[data-scale]");
    if (!btn) return;

    scaleControls.querySelector(".active").classList.remove("active");
    btn.classList.add("active");

    const scaleValue = btn.dataset.scale;
    document.documentElement.style.setProperty("--scale-modifier", scaleValue);
}

//FUNTIONS------------------------------------------------------------------------------------------------------------------------------------------------------------

function init() {
    // Load the fileList from localStorage when the page loads
    fileList = loadFileListFromLocalStorage();

    // Generate thumbnails for stored files in fileList
    fileList.forEach(file => generateThumbnail(file));

    displayStartMessage(fileList);

      
}

function displayStartMessage(array) {
    if (array.length==0){
        startMessage.classList.remove("hidden");
    } else{
        startMessage.classList.add("hidden");
    }
    
}

// Load file list from localStorage and convert objects back to File instances
function loadFileListFromLocalStorage() {
    const savedList = localStorage.getItem("fileList");
    if (savedList) {
        const parsedList = JSON.parse(savedList);
        return parsedList.map(fileData => {
            //Base64 string to recreate the Blob and File
            const byteString = atob(fileData.data.split(',')[1]); // Decode Base64
            const mimeString = fileData.data.split(',')[0].split(':')[1].split(';')[0]; // Get MIME type
            const byteNumbers = new Array(byteString.length).fill(null).map((_, i) => byteString.charCodeAt(i));
            const byteArray = new Uint8Array(byteNumbers);

            return new File([new Blob([byteArray], { type: mimeString })], fileData.name, {
                type: fileData.type,
                size: fileData.size,
            });
        });
        
    }
    
    return [];
    
}

// Add new files, validate them, and update the file list
function addFiles(files) {
    let warningList = [];
    const validationPromises = []; // Track validation promises for asynchronous handling

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Skip files that are not PNGs
        if (file.type !== "image/png") {
            console.warn(`${file.name} is not a PNG file.`);
            warningList.push(`${file.name} - is not a PNG file.`);
            continue;
        }

		// Validate dimensions of the file asynchronously
            const validationPromise = validateDimensions(file)
            .then(isValid => {
                if (isValid) {
                    // Add file to the list if it's not a duplicate
                    if (!fileList.some(existingFile => existingFile.name === file.name && existingFile.size === file.size)) {
                        fileList.push(file); // Add validated file
                        generateThumbnail(file); // Generate a thumbnail for the file
                        saveFileListToLocalStorage(); // Save the updated list to localStorage
                    } else {
                        console.warn(`${file.name} is already in the file list.`);
                        warningList.push(`${file.name} - is already added.`);
                    }
                } else {
                    console.warn(`${file.name} does not meet the dimension requirements.`);
                    warningList.push(`${file.name} - is the wrong size.`);
                }
            })
            .catch(error => console.error(`Error validating file ${file.name}:`, error));

            

        validationPromises.push(validationPromise); // Store each validation promise
    }

    // Log the updated fileList after all validations are done
    Promise.all(validationPromises)
        .then(() => {

            // Reset the input element to allow re-upload of the same file
            fileZone.value = ""; // Clear the value of the input element
            showWarnings(warningList);
        });
    
}

function showWarnings(warningList){
    if(warningList.length > 0){
        window.alert(warningList.join('\n'));
    }
}

// Generate a thumbnail for a validated file and display it
function generateThumbnail(file) {
    // Ensure the file is valid
    if (!(file instanceof File)) {
        console.error("Invalid file object:", file);
        return;
    }

    // Create a container for the thumbnail
    const div = document.createElement("div");
    div.className = ("file pointer");
    div.innerHTML = `<div><canvas id="thumb-${file.name}"></canvas></div><p>${file.name}</p>`;
    thumbnailDiv.appendChild(div); // Append to the designated container

    // Select the canvas and get its context
    const canvas = div.querySelector("canvas");
    const ctx = canvas.getContext("2d");

    const img = new Image();
    const reader = new FileReader();

    reader.onload = function (e) {
        img.onload = function () {
            // Draw the original image on a temporary canvas to access pixel data
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);

            // Extract the imageData from the temporary canvas
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

            // Crop the image using the pixel object-based cropping function
            const { canvas: croppedCanvas } = cropTransparentEdges(imageData);

            // Copy cropped canvas contents to the thumbnail canvas
            canvas.width = croppedCanvas.width;
            canvas.height = croppedCanvas.height;
            ctx.drawImage(croppedCanvas, 0, 0);

            // Display the uncropped image in the larger view
            displayOriginalImage(file);
        };
        img.src = e.target.result; // Load the file into the image element
    };
    reader.readAsDataURL(file); // Read the file as a Data URL

    // Add selection toggle logic for the thumbnail
    div.addEventListener("click", () => {
        div.classList.toggle("selected");
    });
}

// Validate the dimensions of an image file
function validateDimensions(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                // Check specific width and height requirements
                if (img.width === 140 && img.height === 300) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            img.onerror = () => reject(new Error("Invalid image file."));
            img.src = e.target.result; // Set image source
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file); // Read the file as a data URL
    });
}

// Save the current fileList to localStorage in a simplified format
function saveFileListToLocalStorage() {
    displayStartMessage(fileList);
    const filePromises = fileList.map(file => {
        
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = function (e) {
                resolve({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: e.target.result, // Base64 data of the file
                });
            };
            reader.readAsDataURL(file);

            
        });
    });

    Promise.all(filePromises).then(simplifiedList => {
        localStorage.setItem("fileList", JSON.stringify(simplifiedList));
    });

    //displayStartMessage(fileList);
}

function getPixelObjects(imageData) {
    const { data, width, height } = imageData;
    const pixels = [];
    
    for (let i = 0; i < data.length; i += 4) {
        pixels.push({
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
            a: data[i + 3],
            x: (i / 4) % width,
            y: Math.floor((i / 4) / width),
        });
    }

    return { pixels, width, height };
}

function cropTransparentEdges(imageData) {
    const { pixels, width, height } = getPixelObjects(imageData);

    let top = height, bottom = 0, left = width, right = 0;

    pixels.forEach(pixel => {
        if (pixel.a > 0) {
            top = Math.min(top, pixel.y);
            bottom = Math.max(bottom, pixel.y);
            left = Math.min(left, pixel.x);
            right = Math.max(right, pixel.x);
        }
    });

    // Calculate new dimensions
    const newWidth = right - left + 1;
    const newHeight = bottom - top + 1;

    // Create a new ImageData object
    const newCanvas = document.createElement("canvas");
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    const newCtx = newCanvas.getContext("2d");

    // Create a new ImageData object to store the cropped pixels
    const newImageData = newCtx.createImageData(newWidth, newHeight);

    // Populate the new ImageData with filtered pixels
    const croppedPixels = pixels.filter(pixel =>
        pixel.x >= left && pixel.x <= right && pixel.y >= top && pixel.y <= bottom
    );

    croppedPixels.forEach((pixel, i) => {
        const index = i * 4; // Each pixel has 4 values (r, g, b, a)
        newImageData.data[index] = pixel.r;
        newImageData.data[index + 1] = pixel.g;
        newImageData.data[index + 2] = pixel.b;
        newImageData.data[index + 3] = pixel.a;
    });

    // Put the new ImageData on the canvas
    newCtx.putImageData(newImageData, 0, 0);

    return { canvas: newCanvas, croppedWidth: newWidth, croppedHeight: newHeight };
}

function displayOriginalImage(file) {

    const largeDisplayDiv = document.querySelector("#large-display");

    // Create a container for the image
    const div = document.createElement("div");
    div.classList.add("large-file");
    div.innerHTML = `<p>${file.name}</p>`;
    largeDisplayDiv.appendChild(div);

    const iconsDiv = document.createElement("div");
    const itemDiv = document.createElement("div");
    const templateDspDiv = document.createElement("div");
    const coverAreaDspDiv = document.createElement("div");
    const canvas = document.createElement("canvas");

    // Generate ID for the canvas
    const canvasId = `large-${CSS.escape(file.name)}`;

    canvas.id = canvasId;
    canvas.className = "item-canvas pixelated";
    templateDspDiv.className = "template-display pixelated";
    coverAreaDspDiv.className = "cover-display pixelated";
    iconsDiv.className = "icons-display";
    itemDiv.className = "item-display pixelated";

    const ctx = canvas.getContext("2d");
    div.appendChild(itemDiv);
    div.appendChild(iconsDiv);
    itemDiv.appendChild(templateDspDiv);
    itemDiv.appendChild(coverAreaDspDiv);
    itemDiv.appendChild(canvas);

    canvas.dataset.fileName = file.name;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = function (e) {
        img.onload = function () {
            // Set the canvas dimensions to the original image dimensions
            canvas.width = img.width;
            canvas.height = img.height;

            checkCovereage(img, file.name, iconsDiv);
            
            // Save the original image source
            canvas.dataset.originalSrc = img.src;

            // Draw the full uncropped image onto the canvas
            ctx.drawImage(img, 0, 0);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

}

function trashFiles() {
    const selectedThumbnails = document.querySelectorAll(".file.selected");

    if (!selectedThumbnails.length) {
        alert("No files selected for deletion.");
        return;
    }

    if (confirm("Are you sure you want to delete the selected files?")) {
        selectedThumbnails.forEach((thumbnail) => {
            const fileCanvas = thumbnail.querySelector("canvas");
            if (!fileCanvas) {
                console.error("Thumbnail canvas not found.");
                return;
            }

            const fileName = fileCanvas.id.replace("thumb-", "");
            const escapedFileName = CSS.escape(fileName);

            // Locate the large image display
            const largeCanvas = Array.from(document.querySelectorAll("#large-display canvas")).find((canvas) => canvas.dataset.fileName === fileName);
            if (largeCanvas) {
                const largeImageContainer = largeCanvas.closest(".large-file");
                if (largeImageContainer) {
                    largeImageContainer.remove();
                } 
            }

            // Remove the thumbnail
            thumbnail.remove();

            // Update the fileList
            fileList = fileList.filter((file) => file.name !== fileName);
        });

        saveFileListToLocalStorage();
    }
}

//returns zoom
function getBrowserZoomLevel(){
    const zoomLevel = Math.round(window.devicePixelRatio * 100);
    return zoomLevel;
}

function changeTemplate(){
    let template;
    switch (document.querySelector("#select-template").value){
        case "mannequin": template = "Images/mannequin.png"; break;
        case "mannequin-gSt": template = "Images/gSt_mannequin.png"; break;
        case "skin-1": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAANZa9n8ABQAAACsFAAQAACcTAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAABA.Ye&l=t"; break;
        case "skin-2": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAIL_Of8ABQAAACsFAAQAACcTAQECAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAABvj_1f&l=t"; break;
        case "skin-3": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAN62P1sABQAAACsFAAQAACcTAQICAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADcG9Cc&l=t"; break;
        case "skin-4": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAIoT8NsABQAAACsFAAQAACcTAQMCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAACyl8vd&l=t"; break;
        case "skin-5": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAACy91T8ABQAAACsFAAQAACcTAQQCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAABgQo1b&l=t"; break;
        case "skin-6": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAHgYGr8ABQAAACsFAAQAACcTAQUCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAAOzpYa&l=t"; break;
        case "skin-7": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAACRRHBsABQAAACsFAAQAACcTAQYCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAC9WrvZ&l=t"; break;
        case "skin-8": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAHD005sABQAAACsFAAQAACcTAQcCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADT1qCY&l=t"; break;
        case "skin-9": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAPjltr4ABQAAACsFAAQAACcTAQgCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADDgTCU&l=t"; break;
        case "skin-10": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAKxAeT4ABQAAACsFAAQAACcTAQkCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAACtDSvV&l=t"; break;
        case "skin-11": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAM0T9c0ABQAAACsFAAQADFIrAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAD3QYpZ&l=t"; break;
        case "skin-12": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAP0GgdQABQAAACsFAAQADFIsAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAAFJ4Pk&l=t"; break;
        case "skin-13": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAD3TQiQABQAAACsFAAQADFItAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAABmIFrA&l=t"; break;
        case "skin-14": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAANEZWtQABQAAACsFAAQADFIuAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADDKDGs&l=t"; break;
        case "skin-15": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAABHMmSQABQAAACsFAAQADFIvAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAACgL.iI&l=t"; break;
    }
    document.documentElement.style.setProperty('--bg-template-toggle', `url("${template}")`);
};

function isImageCoveringMask(alphaMask, image) {
    threshold = 229;

    // Create canvases to load the images
    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d");

    const uploadCanvas = document.createElement("canvas");
    const uploadCtx = uploadCanvas.getContext("2d");

    // Ensure both images are the same size
    const width = alphaMask.width;
    const height = alphaMask.height;
    maskCanvas.width = uploadCanvas.width = width;
    maskCanvas.height = uploadCanvas.height = height;

    // Draw the images onto their respective canvases
    maskCtx.drawImage(alphaMask, 0, 0, width, height);
    uploadCtx.drawImage(image, 0, 0, width, height);

    // Get the pixel data from both images
    const maskData = maskCtx.getImageData(0, 0, width, height).data;
    const uploadData = uploadCtx.getImageData(0, 0, width, height).data;

    // Iterate through each pixel
    for (let i = 0; i < maskData.length; i += 4) {
        const maskAlpha = maskData[i + 3]; // Alpha value of the mask pixel
        const uploadAlpha = uploadData[i + 3]; // Alpha value of the uploaded image pixel

        // If the mask pixel is above the threshold
        if (maskAlpha > threshold) {
            // Check if the uploaded image pixel also meets the threshold
            if (uploadAlpha <= threshold) {
                //console.warn(`Pixel at index ${i / 4} does not meet the threshold.`);
                return false; // The mask pixel is not covered
            }
        }
    }

    return true; // All relevant mask pixels are covered
}

function checkCovereage(image, name, div){
    const boobCvrgImg = new Image();
    const crotchCvrgImg = new Image();

    boobCvrgImg.src = "Images/Boob_Area.png";
    crotchCvrgImg.src = "Images/Crotch_Area.png";

    boobCvrgImg.onload = () => {
        crotchCvrgImg.onload = () => {

            const result = isImageCoveringMask(boobCvrgImg, image);
            const result1 = isImageCoveringMask(crotchCvrgImg, image);

            if (result) {
                const iconImg = document.createElement("img");
                iconImg.src = "Images/icon_covers_top.png"
                div.appendChild(iconImg);
            }
            if (result1) {
                const iconImg = document.createElement("img");
                iconImg.src = "Images/icon_covers_bottom.png"
                div.appendChild(iconImg);
            }
        };
    };
}

function applyRedOverlay(ctx, canvas) {
    const newCanvas = document.createElement("canvas");
    newCanvas.className = "opaqueFilter";

    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;

    canvas.after(newCanvas);

    const ctx1 = newCanvas.getContext("2d");


    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Modify the pixel data to make all non-transparent pixels red and fully opaque
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 0) { // If alpha > 0
            pixels[i] = 255; // Red channel
            pixels[i + 1] = 0; // Green channel
            pixels[i + 2] = 0; // Blue channel
            pixels[i + 3] = 255; // Fully opaque
        }
    }

    ctx1.putImageData(imageData, 0, 0);
}


function drawBoundingBox(ctx, canvas) {

    const newCanvas = document.createElement("canvas");
    newCanvas.className = "boundingBox";

    newCanvas.width = canvas.width+2;
    newCanvas.height = canvas.height+2;

    canvas.after(newCanvas);

    const ctx1 = newCanvas.getContext("2d");

    
    // Get image data from the canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    let minX = width, maxX = 0, minY = height, maxY = 0;

    // Detect the non-transparent area
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4; // Each pixel has 4 components (RGBA)
            const alpha = data[index + 3]; // Alpha channel

            if (alpha > 0) { // Non-transparent pixel

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }

    // Ensure we detected a region
    if (minX <= maxX && minY <= maxY) {
        // Draw the bounding box
        ctx1.strokeStyle = "black";
        ctx1.lineWidth = 1;

        const boxWidth = maxX - minX + 2;
        const boxHeight = maxY - minY + 2;
        ctx1.strokeRect(minX+0.5, minY+0.5, boxWidth, boxHeight);
    }
}

//Hide or extend the Menu
function toggleMenu(){
    const menuDiv = document.querySelector("#toggle-menu");
    if (menuDiv.className == "hidden"){
        menuDiv.classList.remove("hidden");
        menuBtn.src="Images/arrow-left.svg";
    }
    else{
        menuDiv.className = "hidden";
        menuBtn.src="Images/arrow-right.svg";
    }
}

// remove all files
function startOver(){
    if (fileList.length > 0) {
        if (confirm("Are you sure you want to remove all files?")) {
            fileList.forEach(file => {
                const fileName = file.name;
                escapedFileName = CSS.escape(fileName);

                canvasThumbnail = document.querySelector(`#thumb-${escapedFileName}`);
                thumbnailParent = canvasThumbnail.closest(".file");
                thumbnailParent.remove();

                const largeCanvas = Array.from(document.querySelectorAll("#large-display canvas")).find((canvas) => canvas.dataset.fileName === fileName)
                largeParent = largeCanvas.closest(".large-file");
                largeParent.remove();

                // Update the fileList
                fileList = fileList.filter((file) => file.name !== fileName);
            });
            saveFileListToLocalStorage();
        }; 
    } else {
        alert("Files are already empty");
        return;
    }
}

//Adjust checkered background square size
function adjustChequeredSize(){
    document.documentElement.style.setProperty('--bg-size', 28 * 100/getBrowserZoomLevel()+1+("px"));
}

// Add Droped files
function dropHandler(e) {
    e.preventDefault(); // Prevent default behavior for drop event
    const files = e.dataTransfer.files; // Retrieve files from the event
    addFiles(files); // Add files to the file list
}

function applyBackground(e){
    const isChecked = e.target.checked;

    if (isChecked) {
        document.documentElement.style.setProperty('--bg-color-toggle', bgColorPicker.value);

    } else {
        document.documentElement.style.setProperty('--bg-color-toggle', (`url("Images/Transparent.png")`));
    }
}

function changeBgColor(e){
    const color = e.target.value;
    document.documentElement.style.setProperty('--bg-color-toggle', color);
    bgColorCb.checked = true;
}

function toggleCover(e){
    const isChecked = e.target.checked;
    if (isChecked) {
        document.documentElement.style.setProperty('--bg-cover-toggle', `url("Images/Cover_Area.png")`);
    } else {
        document.documentElement.style.setProperty('--bg-cover-toggle', "none");
    }
}

function toggleTemplate(e){
    const isChecked = e.target.checked;
    
    if (isChecked) {
        changeTemplate();
    } else {
        document.documentElement.style.setProperty('--bg-template-toggle', "none");
    }
}

//INITIALISE!--------------------------------------------------------------------------------------------------------------

init();