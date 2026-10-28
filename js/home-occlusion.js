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
  const ridge=`M 0 401 L 9 399 L 16 409 L 27 409 L 34 416
    L 47 412 L 56 417 L 62 413 L 75 420 L 84 421 L 91 429
    L 109 428 L 117 435 L 130 437 L 143 443 L 152 438 L 165 437
    L 176 445 L 186 447 L 196 458 L 209 461 L 216 469 L 230 473
    L 242 481 L 252 481 L 265 490 L 280 492 L 293 501 L 306 499
    L 321 506 L 335 510 L 347 516 L 361 514 L 375 521 L 392 516
    L 410 513 L 423 515 L 438 511 L 456 513 L 474 518 L 492 518
    L 511 523 L 530 524 L 548 530 L 565 533 L 580 538 L 597 537
    L 613 544 L 632 547 L 647 551 L 662 555 L 681 562 L 698 568
    L 715 575 L 733 579 L 748 585 L 765 587 L 780 598 L 795 603
    L 808 602 L 821 611 L 836 612 L 849 607 L 866 612 L 880 616
    L 896 623 L 911 636 L 928 641 L 942 644 L 956 652 L 972 652
    L 985 660 L 1002 659 L 1016 666 L 1031 671 L 1044 685
    L 1046 700 L 1057 706 L 1070 704 L 1083 714 L 1096 710
    L 1108 703 L 1127 698 L 1141 701 L 1157 701 L 1171 706
    L 1189 708 L 1205 719 L 1220 720 L 1233 728 L 1250 729
    L 1263 740 L 1281 743 L 1298 748 L 1319 749 L 1332 757
    L 1356 761 L 0 761 Z`;
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
