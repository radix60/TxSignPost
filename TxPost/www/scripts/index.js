// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=397704
// To debug code on page load in cordova-simulate or on Android devices/emulators: launch your app, set breakpoints, 
// and then run "window.location.reload()" in the JavaScript Console.

//var rippleApi = new ripple.RippleAPI({ server: 'wss://s-east.ripple.com:443' });

(function () {
    "use strict";

    var rippleApi, rippledNode;
    var rippledNodes = {
        's.altnet.rippletest.net': 'wss://s.altnet.rippletest.net:51233',
        's-east.ripple.com': 'wss://s-east.ripple.com:443',
        's-west.ripple.com': 'wss://s-west.ripple.com:443',
        'custom node': 'wss://'
    };

    var unsignedTransactionQRCode = null;
    var signedRippleTransactionHex;

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

    var rippleSequence = 0;
    var rippleFeeEstimate = 0;
    var rippleDropMultiplier = 1000000;

    document.addEventListener('deviceready', onDeviceReady.bind(this), false);

    function onDeviceReady() {
        // Handle the Cordova pause and resume events
        document.addEventListener('pause', onPause.bind(this), false);
        document.addEventListener('resume', onResume.bind(this), false);

        // Cordova has been loaded. Perform any initialization that requires Cordova here.

        $('#build-ripple-payment-form').validate();
        $('#scan-ripple-from-address-btn').click(scanRippleFromAddress);
        $('#scan-ripple-to-address-btn').click(scanRippleToAddress);
        $('#build-ripple-payment-form').submit(buildRipplePayment);
        $('#scan-ripple-transaction-btn').click(scanRippleSignedTransaction);
        $('#print-unsigned-ripple-transaction-btn').click(printUnsignedRippleTransaction);
        $('#submit-ripple-transaction-btn').click(submitRippleTransaction);
        $('#ripple-payment-from-address').change(getRippleFromAddressInfo);
        $('#ripple-payment-to-address').change(getRippleToAddressBalances);
        $('#rippled-nodes').change(changeRippledNode);

        var qrSize = Math.min($(window).width(), $(window).height()) * .9;
        unsignedTransactionQRCode = new QRCode($('#unsigned-ripple-transaction-qr')[0],
            {
                width: qrSize,
                height: qrSize
            });

        var nodeSelectBox = $('#rippled-nodes')
        for (var key in rippledNodes) {
            nodeSelectBox.append($("<option />").val(rippledNodes[key]).text(key));
        }

        nodeSelectBox.val(rippledNodes['s.altnet.rippletest.net']);
        changeRippledNode();
    };

    function onPause() {
        // TODO: This application has been suspended. Save application state here.
    };

    function onResume() {
        // TODO: This application has been reactivated. Restore application state here.
    };

    function changeRippledNode() {
        if (rippleApi) {
            rippleApi.disconnect();
            $('#ripple-connection-status').html("Disconnected");
        }

        rippledNode = $('#rippled-nodes option:selected').val();
        rippleApi = new ripple.RippleAPI({
            server: rippledNode
        });
        rippleApi.connect()
            .then(
            () => { $('#ripple-connection-status').html("Connected"); },
            error => { $('#ripple-connection-status').html("Disconnected"); }
            );
    }

    function scanRippleFromAddress() {
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                $('#ripple-payment-from-address').val(result.text);
                getRippleFromAddressInfo();
            },
            function (error) {

            },
            scannerSettings
        );
        return false;
    }

    function scanRippleToAddress() {
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                $('#ripple-payment-to-address').val(result.text);
                getRippleToAddressInfo()
            },
            function (error) {

            },
            scannerSettings
        );
        return false;
    }

    function buildRipplePayment(e) {
        if (!$('#build-ripple-payment-form').valid()) {
            return false;
        }

        var amount = parseFloat($('#ripple-payment-amount').val());
        amount *= rippleDropMultiplier;
        var fee = rippleFeeEstimate * rippleDropMultiplier;

        var payment = {
            "TransactionType": "Payment",
            "Account": $('#ripple-payment-from-address').val(),
            "Destination": $('#ripple-payment-to-address').val(),
            "Amount": amount.toString(),
            "Flags": 2147483648,
            "Sequence": rippleSequence,
            "Fee": fee.toString(),
            "Temp": "QR Code hack"
        };

        var json = JSON.stringify(payment, null, 2);
        $("#unsigned-ripple-transaction-json").html(json);
        hljs.initHighlighting.called = false;
        hljs.initHighlighting();

        unsignedTransactionQRCode.makeCode(json);
        $(":mobile-pagecontainer").pagecontainer("change", "#unsigned-ripple-transaction-page");
    }

    function getRippleFromAddressInfo() {
        var address = $('#ripple-payment-from-address').val();
        rippleApi.getAccountInfo(address)
            .then(result => {
                rippleSequence = result.sequence;
                $('#ripple-payment-from-address-balances').html(JSON.stringify(result, null, 2));
                hljs.initHighlighting.called = false;
                hljs.initHighlighting();
            }, error => {
                $('#ripple-payment-from-address-balances').html(error);
            });
        rippleApi.getFee()
            .then(fee => {
                rippleFeeEstimate = fee;
            });
    }

    function getRippleToAddressBalances() {
        var address = $('#ripple-payment-to-address').val();
        rippleApi.getBalances(address)
            .then(result => {
                $('#ripple-payment-to-address-balances').html(JSON.stringify(result, null, 2));
                hljs.initHighlighting.called = false;
                hljs.initHighlighting();
            }, error => {
                $('#ripple-payment-to-address-balances').html(error);
            });
    }

    function scanRippleSignedTransaction() {
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                signedRippleTransactionHex = base64ToHex(result.text);
                var decoded = rippleBinaryCodec.decode(signedRippleTransactionHex);
                $('#signed-ripple-transaction-json').html(JSON.stringify(decoded, null, 2));
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

    function submitRippleTransaction() {
        var result = rippleApi.submit(signedRippleTransactionHex)
            .then(result => {
                $('#ripple-transaction-result').html(JSON.stringify(result, null, 2));
                hljs.initHighlighting.called = false;
                hljs.initHighlighting();
                $(":mobile-pagecontainer").pagecontainer("change", "#ripple-transaction-result-page");
            }, error => {
                $('#ripple-transaction-result').html(JSON.stringify(error, null, 2));
                hljs.initHighlighting.called = false;
                hljs.initHighlighting();
                $(":mobile-pagecontainer").pagecontainer("change", "#ripple-transaction-result-page");
            });
    }

    function printUnsignedRippleTransaction() {
        cordova.plugins.printer.print($('#unsigned-ripple-transaction-container')[0], 'Ripple Address');
    }

    function base64ToHex(base64) {
        return atob(base64).split('')
            .map(function (aChar) {
                return ('0' + aChar.charCodeAt(0).toString(16)).slice(-2);
            }).join('').toUpperCase();
    }
})();