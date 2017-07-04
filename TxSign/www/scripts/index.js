// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=397704
// To debug code on page load in cordova-simulate or on Android devices/emulators: launch your app, set breakpoints, 
// and then run "window.location.reload()" in the JavaScript Console.
var rippleApi = new ripple.RippleAPI();
var unsignedTransaction = null;
var addressQRCode = null;
var secretQRCode = null;
var genericQRCode = null;
var signedTransactionQRCode = null;
var scannerSettings = {
    preferFrontCamera: false, // iOS and Android
    showFlipCameraButton: true, // iOS and Android
    showTorchButton: true, // iOS and Android
    //torchOn: true, // Android, launch with the torch switched on (if available)
    prompt: "Place transaction QR code in the scan area", // Android
    //resultDisplayDuration: 500, // Android, display scanned text for X ms. 0 suppresses it entirely, default 1500
    formats: "QR_CODE", // default: all but PDF_417 and RSS_EXPANDED
    //orientation: "landscape", // Android only (portrait|landscape), default unset so it rotates with the device
    disableAnimations: true, // iOS
    disableSuccessBeep: false // iOS
};

(function () {
    "use strict";

    document.addEventListener('deviceready', onDeviceReady.bind(this), false);

    function onDeviceReady() {
        // Handle the Cordova pause and resume events
        document.addEventListener('pause', onPause.bind(this), false);
        document.addEventListener('resume', onResume.bind(this), false);

        // Cordova has been loaded. Perform any initialization that requires Cordova here.
        $(document).on("pagecontainershow", onPageChanged);

        $('#scan-ripple-transaction-btn').click(scanRippleTransaction);
        $('#rescan-ripple-transaction-btn').click(scanRippleTransaction);
        $('#sign-ripple-transaction-btn').click(signRippleTransaction);
        $('#generate-ripple-address-btn').click(generateAddress);
        $('#make-generic-qr-code-btn').click(makeQrCode);
        $('#generic-qr-code-input').change(makeQrCode);
        $('#generic-qr-code-input').keyup(makeQrCode);
        $('#print-ripple-address-btn').click(printRippleAddress);
        $('#print-ripple-secret-btn').click(printRippleSecret);
        $('#print-generic-qr-code-btn').click(printGeneric);
        $('#print-signed-ripple-transaction-btn').click(printRippleSignedTransaction);

        var qrSize = Math.min($(window).width(), $(window).height()) * .9;
        signedTransactionQRCode = new QRCode($('#ripple-signed-transaction-qr')[0],
            {
                width: qrSize,
                height: qrSize
            });
        addressQRCode = new QRCode($('#ripple-address-qr')[0],
            {
                width: qrSize,
                height: qrSize
            });
        secretQRCode = new QRCode($("#ripple-secret-qr")[0],
            {
                width: qrSize,
                height: qrSize,
                colorDark: "#ff0000"
            });
        genericQRCode = new QRCode($("#generic-qr")[0],
            {
                width: qrSize,
                height: qrSize
            });
    }

    function onPause() {
        // TODO: This application has been suspended. Save application state here.
    }

    function onResume() {
        // TODO: This application has been reactivated. Restore application state here.
    }

    function onPageChanged(event, ui) {
        switch (ui.toPage[0].id) {
            case "home-page":
                clear();
                break;
        }
    }

    function scanRippleTransaction() {
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                unsignedTransaction = JSON.parse(result.text);
                if (unsignedTransaction.hasOwnProperty('txJSON')) {
                    unsignedTransaction = JSON.parse(unsignedTransaction.txJSON);
                }

                var transactionString = JSON.stringify(unsignedTransaction, null, 2);
                $("#unsigned-ripple-transaction").html(transactionString);
                hljs.initHighlighting.called = false;
                hljs.initHighlighting();
                $(":mobile-pagecontainer").pagecontainer("change", "#review-ripple-transaction-page");
            },
            function (error) {

            },
            scannerSettings
        );
        return false;
    }

    function signRippleTransaction() {
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                var secret = result.text;
                var txJSON = JSON.stringify(unsignedTransaction);
                var signedHex = rippleApi.sign(txJSON, secret).signedTransaction;
                var decoded = rippleBinaryCodec.decode(signedHex);
                var signedBase64 = hexToBase64(signedHex);
                $("#signed-ripple-transaction").html(JSON.stringify(decoded, null, 2));
                signedTransactionQRCode.makeCode(signedBase64);
                hljs.initHighlighting.called = false;
                hljs.initHighlighting();
                $(":mobile-pagecontainer").pagecontainer("change", "#signed-ripple-transaction-page");
            },
            function (error) {

            },
            scannerSettings
        );
        return false;
    }

    function generateAddress() {
        clear();
        var key = rippleApi.generateAddress();

        $('#ripple-address-text').html(key.address);
        addressQRCode.makeCode(key.address);
        $('#ripple-address-container').show();

        $('#ripple-secret-text').html(key.secret);
        secretQRCode.makeCode(key.secret);
        $('#ripple-secret-container').show();

        $(":mobile-pagecontainer").pagecontainer("change", "#ripple-secret-page");
    }

    function makeQrCode() {
        clear();
        var text = $('#generic-qr-code-input').val();
        if (text) {
            $('#generic-qr-text').html(text);
            genericQRCode.makeCode(text);
            $('#generic-qr-container').show();
        }
        else {
            $('#generic-qr-text').html('');
            genericQRCode.clear();
            $('#generic-qr-container').hide();
        }
    }

    function printRippleAddress() {
        cordova.plugins.printer.print($('#ripple-address-container')[0], 'Ripple Address');
    }

    function printRippleSecret() {
        cordova.plugins.printer.print($('#ripple-secret-container')[0], 'Ripple Secret');
    }

    function printGeneric() {
        cordova.plugins.printer.print($('#generic-qr-container')[0], 'QR Code');
    }

    function printRippleSignedTransaction() {
        cordova.plugins.printer.print($('#ripple-signed-transaction-container')[0], 'Ripple Signed Transaction');
    }

    function clear() {
        $('#ripple-address-text').html('');
        addressQRCode.clear();
        $('#ripple-address-container').hide();

        $('#ripple-secret-text').html('');
        secretQRCode.clear();
        $('#ripple-secret-container').hide();

        $('#generic-qr-code-input').val('');
        $('#generic-qr-text').html('');
        genericQRCode.clear();
        $('#generic-qr-container').hide();
    }

    function hexToBase64(hexstring) {
        return btoa(hexstring.match(/\w{2}/g).map(function (a) {
            return String.fromCharCode(parseInt(a, 16));
        }).join(""));
    }
})();
