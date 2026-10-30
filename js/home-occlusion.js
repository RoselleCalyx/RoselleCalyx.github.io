/* Occlusion contours in the source landscape's own 1672 x 761 coordinates.
   The painting is unchanged. Only the traveller, cat, near rock ridge and
   individual plants remove pixels from the animated layers above it. */
(function(){
  // The overlapping folded legs, boots and their contact shadow form one
  // near-depth surface. Do not cut a V into the trousers: that exposed the
  // spacecraft across solid fabric and made the tiny boot crevice flash.
  const traveller=`M 545 334 C 531 334 524 339 519 351
    C 515 361 509 370 500 380 C 488 389 480 394 475 404
    C 468 414 460 418 455 429 C 448 436 443 443 442 451
    C 436 458 435 468 435 477 C 431 482 430 491 426 498
    L 419 505 L 410 507 L 406 512 L 409 516 L 425 512
    C 445 515 468 517 490 518 C 509 524 530 527 546 526
    C 554 531 561 534 568 533 C 580 536 588 538 598 539
    L 610 541 L 615 543 L 624 548
    L 631 546 L 628 539 L 623 532 L 630 529 L 626 516
    L 620 493 L 614 471 C 611 456 607 450 599 451
    L 590 456 L 584 458 L 587 447 C 593 438 590 426 585 418
    L 579 406 L 569 399 L 560 397 L 566 383
    C 573 379 574 370 576 362 C 579 351 574 342 565 339
    C 559 335 552 335 545 334 Z`;
  const cat=`M 633 440 L 643 450 L 652 448 L 659 440
    Q 662 439 663 449 L 665 457 C 674 468 674 478 668 485
    L 674 491 C 688 498 697 508 702 521 C 706 532 707 543 705 550
    L 710 554 C 720 558 733 556 740 564 C 747 570 745 578 738 582
    Q 733 586 727 581 L 711 575 L 697 572 L 686 564
    L 674 561 L 657 559 L 645 555 L 636 553 L 632 550
    L 639 545 L 638 526 L 634 509 L 631 492
    C 625 486 623 477 625 467 L 629 460 L 630 447 Z`;
  // From x 733 the ridge is traced at 4.7x over the painting: sunlit rims, the
  // bush beside the cat and the right outcrop are near rock; cloud gaps stay open.
  const ridge=`M 0 401 L 9 399 L 16 409 L 27 409 L 34 416
    L 47 412 L 56 417 L 62 413 L 75 420 L 84 421 L 91 429
    L 109 428 L 117 435 L 130 437 L 143 443 L 152 438 L 165 437
    L 176 445 L 186 447 L 196 458 L 209 461 L 216 469 L 230 473
    L 242 481 L 252 481 L 265 490 L 280 492 L 293 501 L 306 499
    L 321 506 L 335 510 L 347 516 L 361 514 L 375 521 L 392 516
    L 410 513 L 423 515 L 438 511 L 456 513 L 474 518 L 492 518
    L 511 523 L 530 524 L 548 530 L 565 533 L 580 538 L 597 537
    L 613 544 L 632 547 L 647 551 L 662 555 L 681 562 L 698 568
    L 715 575
    L 733 579 L 742.7 581.9 L 751.2 580.8 L 761.9 579.8 L 768.2 580.4 L 772.5 583
    L 778.9 587.2 L 785.2 589.7 L 791.6 588.3 L 798 589.3 L 804.4 591.4 L 810.7 594
    L 817.1 596.8 L 823.5 604.2 L 827.7 598.9 L 832 595.3 L 836.2 598.9 L 840.5 594.6
    L 844.7 596.8 L 846.9 604.2 L 850.1 610.1 L 857.5 610.1 L 860 610.8 L 868.5 609.8
    L 877 608.3 L 885.5 609.1 L 891.9 609.8 L 900.4 610.4 L 908.9 611.9 L 915.2 613
    L 923.7 612.5 L 929 610.8 L 934.4 613 L 938.6 617.2 L 943.9 624.6 L 947.1 626.8
    L 957.7 628.2 L 970.5 627.4 L 975.8 628.2 L 981.1 630.4 L 985.4 634.2 L 989.6 637.4
    L 996 640.1 L 1006.6 645.9 L 1017.2 648 L 1030 652.9 L 1032.7 655.1 L 1039.1 659.3
    L 1043.4 662.5 L 1045.9 668.9 L 1047.6 678.9 L 1054 681.6 L 1060.4 685.9 L 1065.7 691.2
    L 1071 697.1 L 1076.3 698.6 L 1083.7 700.1 L 1092.2 702.2 L 1100.7 705 L 1109.2 708.2
    L 1113.5 707.1 L 1117.7 703.9 L 1124.1 700.8 L 1130.5 698 L 1139 696.9 L 1147.5 697.6
    L 1156 698 L 1164.5 696.7 L 1170.9 696.5 L 1177.2 698.6 L 1183.6 701.4 L 1190 702.9
    L 1192.7 704.5 L 1201.2 705.1 L 1209.7 707.7 L 1218.2 712 L 1224.6 715.1 L 1231 717.3
    L 1237.4 718.3 L 1243.7 720 L 1250.1 722.6 L 1256.5 725.1 L 1265 726.8 L 1273.5 728.9
    L 1282 730 L 1288.4 727.2 L 1290.5 730 L 1299 732.8 L 1307.5 735.7 L 1316 738.1
    L 1321.3 732.8 L 1326.6 727.9 L 1329.8 731.1 L 1333 738.5 L 1337.2 741.3 L 1343.6 745.5
    L 1350 748.5 L 1363.4 746 L 1365.5 744.2 L 1371.9 750.2 L 1375 750.6 L 1378.2 753.4
    L 1384.6 756.1 L 1385.7 759.8 L 1386.5 761
    L 0 761 Z`;
  const hair=[
    ['M 514 364 C 505 383 485 385 477 401 C 471 411 470 421 461 430',1.7],
    ['M 506 379 C 483 391 464 396 466 416 C 469 429 452 430 449 444',1.2],
    ['M 485 400 C 458 409 439 420 449 437 C 455 445 444 450 436 458',1.3],
    ['M 465 421 C 443 425 427 440 433 453 C 437 463 427 468 430 478',1.5],
    ['M 451 440 C 427 441 423 456 427 465 C 430 472 439 465 443 461',1.1],
    ['M 478 410 C 464 414 455 422 460 435',1],
    ['M 569 353 C 578 363 575 374 570 380',.8]
  ];
  // Sparse stems and flower heads rising above the solid ridge. Background
  // remains open between them instead of using an expanded silhouette blob.
  const plants=[
    [31,414,28,402],[61,418,56,404],[86,427,83,411],[112,433,111,418],
    [153,440,154,420],[177,449,169,432],[190,453,191,431],[205,465,211,442],
    [225,476,221,454],[240,480,247,460],[259,489,255,467],[274,495,280,468],
    [292,502,294,477],[315,508,308,489],[334,515,337,491],[360,518,366,499],
    [378,519,377,500],[398,516,394,500],[761,591,764,575],[784,601,791,582],
    [807,609,813,590],[826,614,834,598],[848,617,850,601],[866,618,878,603],
    [889,629,887,612],[909,641,916,625],[1018,675,1021,660],[1079,715,1086,697]
  ];
  let mask;
  function createMask(){
    if(mask)return mask;
    mask=document.createElement('canvas');mask.width=1672;mask.height=761;
    const c=mask.getContext('2d');c.fillStyle='#fff';c.strokeStyle='#fff';
    for(const path of [ridge,traveller,cat])c.fill(new Path2D(path));
    c.lineCap='round';c.lineJoin='round';
    for(const [path,width] of hair){c.lineWidth=width;c.stroke(new Path2D(path));}
    for(const [x,y,tx,ty] of plants){
      c.lineWidth=.9;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-2,(y+ty)/2,tx,ty);c.stroke();
      c.beginPath();c.ellipse(tx,ty,1.4,1.1,0,0,Math.PI*2);c.fill();
    }
    return mask;
  }
  function apply(context,frame,density){
    const scale=frame.S*density;
    context.save();context.globalAlpha=1;context.globalCompositeOperation='destination-out';
    const live=window.HomeLife?.active;
    context.drawImage(live?.ready?live.mask:createMask(),frame.left*density,(frame.top+180*frame.S)*density,1672*scale,761*scale);
    context.restore();
  }
  window.HomeOcclusion={createMask,apply,contours:{traveller,cat,ridge}};
})();
