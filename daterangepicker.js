/**
* @version: 1.3.13
* @author: Dan Grossman http://www.dangrossman.info/
* @date: 2014-09-04
* @copyright: Copyright (c) 2012-2014 Dan Grossman. All rights reserved.
* @license: Licensed under Apache License v2.0. See http://www.apache.org/licenses/LICENSE-2.0
* @website: http://www.improvely.com/
*/

(function(root, factory) {

  if (typeof define === 'function' && define.amd) {
    define(['moment', 'jquery', 'exports'], function(momentjs, $, exports) {
      root.daterangepicker = factory(root, exports, momentjs, $);
    });

  } else if (typeof exports !== 'undefined') {
    var momentjs = require('moment');
    var jQuery;
    try {
      jQuery = require('jquery');
    } catch (err) {
      jQuery = window.jQuery;
      if (!jQuery) throw new Error('jQuery dependency not found');
    }

    factory(root, exports, momentjs, jQuery);

  // Finally, as a browser global.
  } else {
    root.daterangepicker = factory(root, {}, root.moment, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function(root, daterangepicker, moment, $) {

    var DateRangePicker = function (element, options, cb) {

        // by default, the daterangepicker element is placed at the bottom of HTML body
        this.parentEl = 'body';

        //element that triggered the date range picker
        this.element = $(element);

        //tracks visible state
        this.isShowing = false;

        //create the picker HTML object
        var DRPTemplate = '<div class="daterangepicker dropdown-menu">' +
            '	<div class="calendarset">' +
            '		<div class="calendar left">' +
            '		</div>' +
            '		<div class="calendar right">' +
            '		</div>' +
            '	</div>' +
            '	<div class="ranges">' +
            '	  <div class="range_labels"><img class="glyphicon" src="images/clock.svg"/>&nbsp;Time Range: <span></span></div>' +
            '     <div class="range_gran"><img class="glyphicon" src="images/Granuarity.svg"/>&nbsp;Granularity: <span></span></div>' +
            '     <div class="range_serverBtn">' +
            '     <div class="range_serverTime"><img class="glyphicon" src="images/fetching_time.svg"/>&nbsp;Server Fetch Time: <span></span></div>' +
            '	    <div class="range_inputs">' +
            '		   <button class="applyBtn" disabled="disabled"></button>&nbsp;' +
            '		   <button class="cancelBtn"></button>' +
            '	    </div>' +
            '     </div>' +
            '	</div>' +
            '</div>';

        //custom options
        if (typeof options !== 'object' || options === null)
            options = {};

        this.parentEl = (typeof options === 'object' && options.parentEl && $(options.parentEl).length) ? $(options.parentEl) : $(this.parentEl);
        this.container = $(DRPTemplate).appendTo(this.parentEl);

        this.setOptions(options, cb);

        //apply CSS classes and labels to buttons
        var c = this.container;
        $.each(this.buttonClasses, function (idx, val) {
            c.find('button').addClass(val);
        });

        //this.container.find('.daterangepicker_start_input label').html(this.locale.fromLabel);
        //this.container.find('.daterangepicker_end_input label').html(this.locale.toLabel);

        if (this.applyClass.length)
            this.container.find('.applyBtn').addClass(this.applyClass);
        if (this.cancelClass.length)
            this.container.find('.cancelBtn').addClass(this.cancelClass);
        this.container.find('.applyBtn').html(this.locale.applyLabel);
        this.container.find('.cancelBtn').html(this.locale.cancelLabel);

        //event listeners

        this.container.find('.calendar')
            .on('click.daterangepicker', '.prev', $.proxy(this.clickPrev, this))
            .on('click.daterangepicker', '.next', $.proxy(this.clickNext, this))
            .on('click.daterangepicker', 'td.available', $.proxy(this.clickDate, this))
            .on('mouseenter.daterangepicker', 'td.available', $.proxy(this.hoverDate, this))
            .on('mouseleave.daterangepicker', 'td.available', $.proxy(this.updateFormInputs, this))
            .on('change.daterangepicker', 'select.yearselect', $.proxy(this.updateMonthYear, this))
            .on('change.daterangepicker', 'select.monthselect', $.proxy(this.updateMonthYear, this))
            .on('change.daterangepicker', 'select.hourselect,select.minuteselect,select.ampmselect', $.proxy(this.updateTime, this));

        this.container.find('.ranges')
            .on('click.daterangepicker', 'button.applyBtn', $.proxy(this.clickApply, this))
            .on('click.daterangepicker', 'button.cancelBtn', $.proxy(this.clickCancel, this))
            .on('click.daterangepicker', '.daterangepicker_start_input,.daterangepicker_end_input', $.proxy(this.showCalendars, this))
            .on('change.daterangepicker', '.daterangepicker_start_input,.daterangepicker_end_input', $.proxy(this.inputsChanged, this))
            .on('keydown.daterangepicker', '.daterangepicker_start_input,.daterangepicker_end_input', $.proxy(this.inputsKeydown, this))
            .on('click.daterangepicker', 'li', $.proxy(this.clickRange, this))
            .on('mouseenter.daterangepicker', 'li', $.proxy(this.enterRange, this))
            .on('mouseleave.daterangepicker', 'li', $.proxy(this.updateFormInputs, this));

        if (this.element.is('input')) {
            this.element.on({
                'click.daterangepicker': $.proxy(this.show, this),
                'focus.daterangepicker': $.proxy(this.show, this),
                'keyup.daterangepicker': $.proxy(this.updateFromControl, this)
            });
        } else {
            this.element.on('click.daterangepicker', $.proxy(this.toggle, this));
        }

    };

    DateRangePicker.prototype = {

        constructor: DateRangePicker,

        setOptions: function(options, callback) {

            this.startDate = moment().startOf('day');
            this.endDate = moment().endOf('day');
            this.minDate = false;
            this.maxDate = false;
            this.dateLimit = false;
            this.timezone = 0;

            this.showDropdowns = false;
            this.showWeekNumbers = false;
            this.timePicker = false;
            this.timePickerIncrement = 30;
            this.timePicker12Hour = true;
            this.includeMinutes = true;
            this.singleDatePicker = false;
            this.ranges = {};
            this.granMap = {};
            this.hourGranAllowed = true;
            this.allowSlowCall = false;
            this.selectedRangeSlow = false;
            this.snapMessageLeft = '';
            this.snapMessageRight = '';
            this.currentGran = 86400;
            this.opens = 'right';
            if (this.element.hasClass('pull-right'))
                this.opens = 'left';

            this.buttonClasses = ['btn', 'btn-small btn-sm'];
            this.applyClass = 'btn-success';
            this.cancelClass = 'btn-default';

            this.format = 'MM/DD/YYYY';

            this.locale = {
                applyLabel: 'Apply',
                cancelLabel: 'Cancel',
                fromLabel: 'From',
                toLabel: 'To',
                weekLabel: 'W',
                separator: ' to ',
                customRangeLabel: 'Custom Range',
                daysOfWeek: moment.weekdaysMin(),
                monthNames: moment.monthsShort(),
                firstDay: moment.localeData()._week.dow
            };

            this.cb = function () { };

            if (typeof options.format === 'string')
                this.format = options.format;

            if (typeof options.startDate === 'string')
                this.startDate = moment(options.startDate, this.format);

            if (typeof options.endDate === 'string')
                this.endDate = moment(options.endDate, this.format);

            if (typeof options.minDate === 'string')
                this.minDate = moment(options.minDate, this.format);

            if (typeof options.maxDate === 'string')
                this.maxDate = moment(options.maxDate, this.format);

            if (typeof options.startDate === 'object')
                this.startDate = moment(options.startDate);

            if (typeof options.endDate === 'object')
                this.endDate = moment(options.endDate);

            if (typeof options.minDate === 'object')
                this.minDate = moment(options.minDate);

            if (typeof options.maxDate === 'object')
            {
                 this.maxDate = moment(options.maxDate);
            }
               
            if (typeof options.timezone != undefined)
            {
                this.timezone = options.timeZone;
                // this.minDate.utcOffset(this.timezone);
                // this.maxDate.utcOffset(this.timezone);
                // this.startDate.utcOffset(this.timezone);
                // this.endDate.utcOffset(this.timezone);
            }
             

            if (typeof options.applyClass === 'string')
                this.applyClass = options.applyClass;

            if (typeof options.cancelClass === 'string')
                this.cancelClass = options.cancelClass;

            if (typeof options.dateLimit === 'object')
                this.dateLimit = options.dateLimit;

            if (typeof options.locale === 'object') {

                if (typeof options.locale.daysOfWeek === 'object') {
                    // Create a copy of daysOfWeek to avoid modification of original
                    // options object for reusability in multiple daterangepicker instances
                    this.locale.daysOfWeek = options.locale.daysOfWeek.slice();
                }

                if (typeof options.locale.monthNames === 'object') {
                  this.locale.monthNames = options.locale.monthNames.slice();
                }

                if (typeof options.locale.firstDay === 'number') {
                  this.locale.firstDay = options.locale.firstDay;
                }

                if (typeof options.locale.applyLabel === 'string') {
                  this.locale.applyLabel = options.locale.applyLabel;
                }

                if (typeof options.locale.cancelLabel === 'string') {
                  this.locale.cancelLabel = options.locale.cancelLabel;
                }

                if (typeof options.locale.fromLabel === 'string') {
                  this.locale.fromLabel = options.locale.fromLabel;
                }

                if (typeof options.locale.toLabel === 'string') {
                  this.locale.toLabel = options.locale.toLabel;
                }

                if (typeof options.locale.weekLabel === 'string') {
                  this.locale.weekLabel = options.locale.weekLabel;
                }

                if (typeof options.locale.customRangeLabel === 'string') {
                  this.locale.customRangeLabel = options.locale.customRangeLabel;
                }

                if (typeof options.locale.separator === 'string')
                {
                    this.locale.separator = options.locale.separator;
                }
        
            }

            if (typeof options.opens === 'string')
                this.opens = options.opens;

            if (typeof options.showWeekNumbers === 'boolean') {
                this.showWeekNumbers = options.showWeekNumbers;
            }

            if (typeof options.buttonClasses === 'string') {
                this.buttonClasses = [options.buttonClasses];
            }

            if (typeof options.buttonClasses === 'object') {
                this.buttonClasses = options.buttonClasses;
            }

            if (typeof options.showDropdowns === 'boolean') {
                this.showDropdowns = options.showDropdowns;
            }

            if (typeof options.singleDatePicker === 'boolean') {
                this.singleDatePicker = options.singleDatePicker;
                if (this.singleDatePicker) {
                    this.endDate = this.startDate.clone();
                  //  this.endDate.utcOffset(this.timezone);
                }
            }

            if (typeof options.timePicker === 'boolean') {
                this.timePicker = options.timePicker;
            }

            if (typeof options.timePickerIncrement === 'number') {
                this.timePickerIncrement = options.timePickerIncrement;
            }

            if (typeof options.timePicker12Hour === 'boolean') {
                this.timePicker12Hour = options.timePicker12Hour;
            }

            // update day names order to firstDay
            if (this.locale.firstDay != 0) {
                var iterator = this.locale.firstDay;
                while (iterator > 0) {
                    this.locale.daysOfWeek.push(this.locale.daysOfWeek.shift());
                    iterator--;
                }
            }

            var start, end, range;

            //if no start/end dates set, check if an input element contains initial values
            if (typeof options.startDate === 'undefined' && typeof options.endDate === 'undefined') {
                if ($(this.element).is('input[type=text]')) {
                    var val = $(this.element).val();
                    var split = val.split(this.locale.separator);
                    start = end = null;
                    if (split.length == 2) {
                        start = moment(split[0], this.format);
                        // start.utcOffset(this.timezone);
                        end = moment(split[1], this.format);
                        // end.utcOffset(this.timezone);
                    } else if (this.singleDatePicker) {
                        start = moment(val, this.format);
                        // start.utcOffset(this.timezone);
                        end = moment(val, this.format);
                        // end.utcOffset(this.timezone);
                    }
                    if (start !== null && end !== null) {
                        this.startDate = start;
                        this.endDate = end;
                    }
                }
            }

            if (typeof options.ranges === 'object') {
                for (range in options.ranges) {

                    start = moment(options.ranges[range][0]);
                    // start.utcOffset(this.timezone);
                    end = moment(options.ranges[range][1]);
                    // end.utcOffset(this.timezone);
                    // If we have a min/max date set, bound this range
                    // to it, but only if it would otherwise fall
                    // outside of the min/max.
                    if (this.minDate && start.isBefore(this.minDate))
                    {
                        start = moment(this.minDate);
                        // start.utcOffset(this.timezone);
                    }
                        


                    if (this.maxDate && end.isAfter(this.maxDate))
                    {
                        end = moment(this.maxDate);
                        // end.utcOffset(this.timezone);
                    }
                      

                    // If the end of the range is before the minimum (if min is set) OR
                    // the start of the range is after the max (also if set) don't display this
                    // range option.
                    if ((this.minDate && end.isBefore(this.minDate)) || (this.maxDate && start.isAfter(this.maxDate))) {
                        continue;
                    }

                    this.ranges[range] = [start, end];
                }

                var list = '<ul>';
                for (range in this.ranges) {
                    list += '<li>' + range + '</li>';
                }
                list += '<li>' + this.locale.customRangeLabel + '</li>';
                list += '</ul>';
                this.container.find('.ranges ul').remove();
                this.container.find('.ranges').prepend(list);
            }

            if(typeof options.allowSlowCall == 'boolean')
            {
                this.allowSlowCall =  options.allowSlowCall;
            }

            if(typeof options.hourGranAllowed == 'boolean')
            {
                this.hourGranAllowed =  options.hourGranAllowed;
            }

             if(typeof options.granMap == 'object')
            {
                this.granMap =  options.granMap;
            }

            if (typeof callback === 'function') {
                this.cb = callback;
            }

            if (!this.timePicker) {
                this.startDate = this.startDate.startOf('day');
                this.endDate = this.endDate.endOf('day');
            }

            if (this.singleDatePicker) {
                this.opens = 'right';
                this.container.addClass('single');
                this.container.find('.calendar.right').show();
                this.container.find('.calendar.left').hide();
                if (!this.timePicker) {
                    this.container.find('.ranges').hide();
                } else {
                    this.container.find('.ranges .daterangepicker_start_input, .ranges .daterangepicker_end_input').hide();
                }
                if (!this.container.find('.calendar.right').hasClass('single'))
                    this.container.find('.calendar.right').addClass('single');
            } else {
                this.container.removeClass('single');
                this.container.find('.calendar.right').removeClass('single');
                this.container.find('.ranges').show();
            }

            this.oldStartDate = this.startDate.clone();
            // this.oldStartDate.utcOffset(this.timezone);
            this.oldEndDate = this.endDate.clone();
            this.oldEndDate.utcOffset(this.timezone);
            // this.oldChosenLabel = this.chosenLabel;

            this.leftCalendar = {
                month: moment([this.startDate.year(), this.startDate.month(), 1, this.startDate.hour(), this.startDate.minute()]),
                calendar: []
            };

            this.rightCalendar = {
                month: moment([this.endDate.year(), this.endDate.month(), 1, this.endDate.hour(), this.endDate.minute()]),
                calendar: []
            };

            if (this.opens == 'right') {
                //swap calendar positions
                var left = this.container.find('.calendar.left');
                var right = this.container.find('.calendar.right');

                if (right.hasClass('single')) {
                    right.removeClass('single');
                    left.addClass('single');
                }

                left.removeClass('left').addClass('right');
                right.removeClass('right').addClass('left');

                if (this.singleDatePicker) {
                    left.show();
                    right.hide();
                }
            }

            if (typeof options.ranges === 'undefined' && !this.singleDatePicker) {
                this.container.addClass('show-calendar');
            }

            this.container.addClass('opens' + this.opens);

            this.updateView();
            this.updateCalendars();

        },

        setStartDate: function(startDate) {
            if (typeof startDate === 'string')
            {
                this.startDate = moment(startDate, this.format);
                // this.startDate.utcOffset(this.timezone);
            }


            if (typeof startDate === 'object')
            {
                this.startDate = moment(startDate);
                // this.startDate.utcOffset(this.timezone);
            }
  

            if (!this.timePicker)
            {
                this.startDate = this.startDate.startOf('day'); 
                // this.startDate.utcOffset(this.timezone);
            }
           

            this.oldStartDate = this.startDate.clone();
            // this.oldStartDate.utcOffset(this.timezone);

            this.updateView();
            this.updateCalendars();
            this.updateInputText();
        },

        setEndDate: function(endDate) {
            if (typeof endDate === 'string')
            {
                this.endDate = moment(endDate, this.format);
                // this.endDate.utcOffset(this.timezone);
            }


            if (typeof endDate === 'object')
            {
                this.endDate = moment(endDate);
                // this.endDate.utcOffset(this.timezone);
            }

            if (!this.timePicker)
            {
                this.endDate = this.endDate.endOf('day');
                // this.endDate.utcOffset(this.timezone);
            }
                

            this.oldEndDate = this.endDate.clone();
            // this.oldEndDate.utcOffset(this.timezone);

            this.updateView();
            this.updateCalendars();
            this.updateInputText();
        },

        updateView: function () {
            this.leftCalendar.month.month(this.startDate.month()).year(this.startDate.year()).hour(this.startDate.hour()).minute(this.startDate.minute());
            this.rightCalendar.month.month(this.endDate.month()).year(this.endDate.year()).hour(this.endDate.hour()).minute(this.endDate.minute());
            this.updateFormInputs();
        },

        updateFormInputs: function () {
            this.container.find('input[name=daterangepicker_start]').val(this.startDate.format(this.format));
            this.container.find('input[name=daterangepicker_end]').val(this.endDate.format(this.format));

            if (this.startDate.isSame(this.endDate) || this.startDate.isBefore(this.endDate)) {
                this.container.find('button.applyBtn').removeAttr('disabled');
            } else {
                this.container.find('button.applyBtn').attr('disabled', 'disabled');
            }
        },

        updateFromControl: function () {
            if (!this.element.is('input')) return;
            if (!this.element.val().length) return;

            var dateString = this.element.val().split(this.locale.separator),
                start = null,
                end = null;

            if(dateString.length === 2) {
                start = moment(dateString[0], this.format);
                // start.utcOffset(this.timezone);
                end = moment(dateString[1], this.format);
                // end.utcOffset(this.timezone);
            }

            if (this.singleDatePicker || start === null || end === null) {
                start = moment(this.element.val(), this.format);
                // start.utcOffset(this.timezone);
                end = start;
                // end.utcOffset(this.timezone);
            }

            if (end.isBefore(start)) return;

            this.oldStartDate = this.startDate.clone();
            // this.oldStartDate.utcOffset(this.timezone);
            this.oldEndDate = this.endDate.clone();
            // this.oldEndDate.utcOffset(this.timezone);

            this.startDate = start;
            // this.startDate.utcOffset(this.timezone);
            this.endDate = end;
            // thsi.endDate.utcOffset(this.timezone);

            if (!this.startDate.isSame(this.oldStartDate) || !this.endDate.isSame(this.oldEndDate))
                this.notify();

            this.updateCalendars();
        },

        notify: function () {
            this.updateView();
            this.cb(this.startDate, this.endDate, this.chosenLabel);
        },

        move: function () {
            var parentOffset = { top: 0, left: 0 };
            var parentRightEdge = $(window).width();
            if (!this.parentEl.is('body')) {
                parentOffset = {
                    top: this.parentEl.offset().top - this.parentEl.scrollTop(),
                    left: this.parentEl.offset().left - this.parentEl.scrollLeft()
                };
                parentRightEdge = this.parentEl[0].clientWidth + this.parentEl.offset().left;
            }

            if (this.opens == 'left') {
                this.container.css({
                    top: this.element.offset().top  - 25,
                    right: parentRightEdge - this.element.offset().left - this.element.outerWidth() -5,
                    left: 'auto'
                });
                if (this.container.offset().left < 0) {
                    this.container.css({
                        right: 'auto',
                        left: 9
                    });
                }
            } else {
                this.container.css({
                    top: this.element.offset().top + this.element.outerHeight() - parentOffset.top,
                    left: this.element.offset().left - parentOffset.left,
                    right: 'auto'
                });
                if (this.container.offset().left + this.container.outerWidth() > $(window).width()) {
                    this.container.css({
                        left: 'auto',
                        right: 0
                    });
                }
            }
        },

        toggle: function (e) {
            if (this.element.hasClass('active')) {
                this.hide();
            } else {
                this.show();
            }
        },

        show: function (e) {
            if (this.isShowing) return;

            this.element.addClass('active');
            this.container.show();
            this.move();

            // Create a click proxy that is private to this instance of datepicker, for unbinding
            this._outsideClickProxy = $.proxy(function (e) { this.outsideClick(e); }, this);
            // Bind global datepicker mousedown for hiding and
            $(document)
              .on('mousedown.daterangepicker', this._outsideClickProxy)
              // also explicitly play nice with Bootstrap dropdowns, which stopPropagation when clicking them
              .on('click.daterangepicker', '[data-toggle=dropdown]', this._outsideClickProxy)
              // and also close when focus changes to outside the picker (eg. tabbing between controls)
              .on('focusin.daterangepicker', this._outsideClickProxy);

            this.isShowing = true;
            this.element.trigger('show.daterangepicker', this);
        },

        outsideClick: function (e) {
            var target = $(e.target);
            // if the page is clicked anywhere except within the daterangerpicker/button
            // itself then call this.hide()
            if (
                target.closest(this.element).length ||
                target.closest(this.container).length ||
                target.closest('.calendar-date').length
                ) return;
            this.hide();
        },

        hide: function (e) {
            if (!this.isShowing) return;

            $(document)
              .off('mousedown.daterangepicker')
              .off('click.daterangepicker', '[data-toggle=dropdown]')
              .off('focusin.daterangepicker');

            this.element.removeClass('active');
            this.container.hide();

            if (!this.startDate.isSame(this.oldStartDate) || !this.endDate.isSame(this.oldEndDate))
                this.notify();

            this.oldStartDate = this.startDate.clone();
            // this.oldStartDate.utcOffset(this.timezone);
            this.oldEndDate = this.endDate.clone();
            // this.oldEndDate.utcOffset(this.timezone);

            this.isShowing = false;
            this.element.trigger('hide.daterangepicker', this);
        },

        enterRange: function (e) {
            // mouse pointer has entered a range label
            var label = e.target.innerHTML;
            if (label == this.locale.customRangeLabel) {
                this.updateView();
            } else {
                var dates = this.ranges[label];
                this.container.find('input[name=daterangepicker_start]').val(dates[0].format(this.format));
                this.container.find('input[name=daterangepicker_end]').val(dates[1].format(this.format));
            }
        },

        showCalendars: function() {
            this.container.addClass('show-calendar');
            this.move();
            this.element.trigger('showCalendar.daterangepicker', this);
        },

        hideCalendars: function() {
            this.container.removeClass('show-calendar');
            this.element.trigger('hideCalendar.daterangepicker', this);
        },

        // when a date is typed into the start to end date textboxes
        inputsChanged: function (e) {
            var el = $(e.target);
            var date = moment(el.val(), this.format);
            // date.utcOffset(this.timezone);
            if (!date.isValid()) return;

            var startDate, endDate;
            if (el.attr('name') === 'daterangepicker_start') {
                startDate = date;
                // startDate.utcOffset(this.timezone);
                endDate = this.endDate;
                // endDate.utcOffset(this.timezone);
            } else {
                startDate = this.startDate;
                // startDate.utcOffset(this.timezone);
                endDate = date;
                // endDate.utcOffset(this.timezone);
            }
            this.setCustomDates(startDate, endDate);
        },

        inputsKeydown: function(e) {
            if (e.keyCode === 13) {
                this.inputsChanged(e);
                this.notify();
            }
        },

        updateInputText: function() {
            if (this.element.is('input') && !this.singleDatePicker) {
                this.element.val(this.startDate.format(this.format) + this.locale.separator + this.endDate.format(this.format));
            } else if (this.element.is('input')) {
                this.element.val(this.endDate.format(this.format));
            }
        },

        clickRange: function (e) {
            var label = e.target.innerHTML;
            this.chosenLabel = label;
            if (label == this.locale.customRangeLabel) {
                this.showCalendars();
            } else {
                var dates = this.ranges[label];

                this.startDate = dates[0];
                // this.startDate.utcOffset(this.timezone);
                this.endDate = dates[1];
                // this.endDate.utcOffset(this.timezone);

                if (!this.timePicker) {
                    this.startDate.startOf('day');
                    this.endDate.endOf('day');
                }

                this.leftCalendar.month.month(this.startDate.month()).year(this.startDate.year()).hour(this.startDate.hour()).minute(this.startDate.minute());
                this.rightCalendar.month.month(this.endDate.month()).year(this.endDate.year()).hour(this.endDate.hour()).minute(this.endDate.minute());
                this.updateCalendars();

                this.updateInputText();

                this.hideCalendars();
                this.hide();
                this.element.trigger('apply.daterangepicker', this);
            }
        },

        clickPrev: function (e) {
            var cal = $(e.target).parents('.calendar');
            if (cal.hasClass('left')) {
                this.leftCalendar.month.subtract(1, 'month');
            } else {
                this.rightCalendar.month.subtract(1, 'month');
            }
            this.updateCalendars();
        },

        clickNext: function (e) {
            var cal = $(e.target).parents('.calendar');
            if (cal.hasClass('left')) {
                this.leftCalendar.month.add(1, 'month');
            } else {
                this.rightCalendar.month.add(1, 'month');
            }
            this.updateCalendars();
        },

        hoverDate: function (e) {
            var title = $(e.target).attr('data-title');
            var row = title.substr(1, 1);
            var col = title.substr(3, 1);
            var cal = $(e.target).parents('.calendar');

            if (cal.hasClass('left')) {
                this.container.find('input[name=daterangepicker_start]').val(this.leftCalendar.calendar[row][col].format(this.format));
            } else {
                this.container.find('input[name=daterangepicker_end]').val(this.rightCalendar.calendar[row][col].format(this.format));
            }
        },

        setCustomDates: function(startDate, endDate) {
            this.chosenLabel = this.locale.customRangeLabel;
            if (startDate.isAfter(endDate)) {
                var difference = this.endDate.diff(this.startDate);
                endDate = moment(startDate).add(difference, 'ms');
                // endDate.utcOffset(this.timezone);
            }
            this.startDate = startDate;
            // this.startDate.utcOffset(this.timezone);
            this.endDate = endDate;
            // this.endDate.utcOffset(this.timezone);

            this.updateView();
            this.updateCalendars();
        },

        snapStartDate: function(startDate){
            startDate.set('date', 1);
            return startDate;
        },

        snapEndDate: function(endDate){
            endDate.endOf('month');
            return endDate;
        },

        gransAvailableForDate: function(date)
        {
            var allowedGran = undefined;
            if(this.granMap != undefined)
            {
                for(var granID in this.granMap)
                {
                    if(granID != undefined)
                    {
                        var granObj = this.granMap[granID];
                        if(granObj[0] <= date.toDate() && date.toDate() <= granObj[1])
                        {
                            if(allowedGran == undefined)
                            {
                                allowedGran = parseInt(granID);
                            }
                            else if(allowedGran > parseInt(granID))
                            {
                                allowedGran = parseInt(granID);
                            }
                        }
                    }
                }
            }
            return allowedGran;
        },

        clickDate: function (e) {

        	
            var title = $(e.target).attr('data-title');
            var row = title.substr(1, 1);
            var col = title.substr(3, 1);
            var cal = $(e.target).parents('.calendar');

            var startDate, endDate;
            if (cal.hasClass('left')) {
                startDate = this.leftCalendar.calendar[row][col];
                endDate = this.endDate;
                if (typeof this.dateLimit === 'object') {
                    var maxDate = moment(startDate).add(this.dateLimit).startOf('day');
                    // maxDate.utcOffset(this.timezone);
                    if (endDate.isAfter(maxDate)) {
                        endDate = maxDate;
                        // endDate.utcOffset(this.timezone);
                    }
                }
            } else {
                startDate = this.startDate;
                // startDate.utcOffset(this.timezone);
                endDate = this.rightCalendar.calendar[row][col];
                // endDate.utcOffset(this.timezone);
                 if(typeof this.dateLimit === 'object') {
                    var minDate = moment(endDate).subtract(this.dateLimit).startOf('day');
                    // minDate.utcOffset(this.timezone);
                    if (startDate.isBefore(minDate)) {
                        startDate = minDate;
                        // startDate.utcOffset(this.timezone);
                    }
                }
              //  endDate.hour(0);
            }
            allowedGranStart = this.gransAvailableForDate(startDate);
            allowedGranEnd = this.gransAvailableForDate(endDate);
            this.snapMessageLeft = '';
            this.snapMessageRight = '';
            if(allowedGranStart <= 86400 && allowedGranEnd <=86400)
            {
                this.selectedRangeSlow = false;
            }
            else 
            {
                if(this.allowSlowCall)
                {
                    this.selectedRangeSlow = true;
                }
                else if(allowedGranStart > 86400)
                {
                    startDate = this.snapStartDate(startDate);
                    this.snapMessageLeft = 'snaps to 0' + startDate.get('date');
                }
                else if(allowedGranEnd > 86400)
                {
                    endDate = this.snapEndDate(endDate);
                    this.snapMessageRight = 'snaps to ' + endDate.get('date');
                }
            }
            if(allowedGranStart > allowedGranEnd)
            {
                this.currentGran = allowedGranStart;
            }
            else
            {
                this.currentGran = allowedGranEnd;
            }
            if (this.singleDatePicker && cal.hasClass('left')) {
                endDate = startDate.clone();
                // endDate.utcOffset(this.timezone);
            } else if (this.singleDatePicker && cal.hasClass('right')) {
                startDate = endDate.clone();
                // startDate.utcOffset(this.timezone);
            }

            cal.find('td').removeClass('active');

            $(e.target).addClass('active');

            this.setCustomDates(startDate, endDate);

            if (!this.timePicker)
                endDate.endOf('day');

            if (this.singleDatePicker && !this.timePicker)
                this.clickApply();
        },

        clickApply: function (e) {
            this.updateInputText();
            this.hide();
            this.element.trigger('apply.daterangepicker', this);
        },

        clickCancel: function (e) {
            this.startDate = this.oldStartDate;
            // this.startDate.utcOffset(this.timezone);
            this.endDate = this.oldEndDate;
            // this.endDate.utcOffset(this.timezone);
            this.chosenLabel = this.oldChosenLabel;
            this.updateView();
            this.updateCalendars();
            this.hide();
            this.element.trigger('cancel.daterangepicker', this);
        },

        updateMonthYear: function (e) {
            var isLeft = $(e.target).closest('.calendar').hasClass('left'),
                leftOrRight = isLeft ? 'left' : 'right',
                cal = this.container.find('.calendar.'+leftOrRight);

            // Month must be Number for new moment versions
            var month = parseInt(cal.find('.monthselect').val(), 10);
            var year = cal.find('.yearselect').val();

            this[leftOrRight+'Calendar'].month.month(month).year(year);
            this.updateCalendars();
        },

        updateTime: function(e) {

            var cal = $(e.target).closest('.calendar'),
                isLeft = cal.hasClass('left');

            var hour = parseInt(cal.find('.hourselect').val(), 10);
            var minute = 0;
            if(this.includeMinutes){
              minute = parseInt(cal.find('.minuteselect').val(), 10);
            }

            if (this.timePicker12Hour) {
                var ampm = cal.find('.ampmselect').val();
                if (ampm === 'PM' && hour < 12)
                    hour += 12;
                if (ampm === 'AM' && hour === 12)
                    hour = 0;
            }
            var start = this.startDate.clone();
            // start.utcOffset(this.timezone);
            var end = this.endDate.clone();
            // end.utcOffset(this.timezone);
            start.hour(hour);
            start.minute(minute);
            end.hour(hour);
            end.minute(minute);
             var allowedGranStart = this.gransAvailableForDate(start);
             var allowedGranEnd = this.gransAvailableForDate(end);
            if (isLeft) {
                
                if(allowedGranStart > 3600)
                {
                    if(this.allowSlowCall == false)
                    { 
                        hour = 0;
                        start.set('hour',hour);
                        this.snapMessageLeft = 'snaps to 00:'+minute;
                    }
                }
                this.startDate = start;
                // this.startDate.utcOffset(this.timezone);
                this.leftCalendar.month.hour(hour).minute(minute);
            } else {
                if(allowedGranEnd > 3600)
                {
                    if(this.allowSlowCall == false)
                    {
                        hour = 23;
                        end.set('hour',hour);
                        this.snapMessageRight = 'snaps to 23:'+minute;
                    }
                }
                this.endDate = end;
                // this.endDate.utcOffset(this.timezone);
                this.rightCalendar.month.hour(hour).minute(minute);
            }
            if(allowedGranStart >3600 || allowedGranEnd > 3600)
            {
                if(this.allowSlowCall)
                {
                    this.selectedRangeSlow = true;
                }
            }
            if(allowedGranStart > allowedGranEnd)
            {
                this.currentGran = allowedGranStart;
            }
            else
            {
                this.currentGran = allowedGranEnd;
            }
            this.updateCalendars();
        },

        updateCalendars: function () {
            this.leftCalendar.calendar = this.buildCalendar(this.leftCalendar.month.month(), this.leftCalendar.month.year(), this.leftCalendar.month.hour(), this.leftCalendar.month.minute(), 'left');
            this.rightCalendar.calendar = this.buildCalendar(this.rightCalendar.month.month(), this.rightCalendar.month.year(), this.rightCalendar.month.hour(), this.rightCalendar.month.minute(), 'right');

            this.container.find('.calendar.left').empty().html(this.renderCalendar(this.leftCalendar.calendar, this.startDate, this.minDate, this.maxDate));
            this.container.find('.calendar.right').empty().html(this.renderCalendar(this.rightCalendar.calendar, this.endDate, this.singleDatePicker ? this.minDate : this.startDate, this.maxDate));

            //update start and end date time hours if calendar rendering has changed them
            this.startDate._d.setHours(this.container.find('.calendar.left').find('.hourselect').val());
			this.endDate._d.setHours(this.container.find('.calendar.right').find('.hourselect').val());

          this.container.find('.ranges li').removeClass('active');
            var customRange = true;
            var i = 0;
            for (var range in this.ranges) {
                if (this.timePicker) {
                    if (this.startDate.isSame(this.ranges[range][0]) && this.endDate.isSame(this.ranges[range][1])) {
                        customRange = false;
                        this.chosenLabel = this.container.find('.ranges li:eq(' + i + ')')
                            .addClass('active').html();
                    }
                } else {
                    //ignore times when comparing dates if time picker is not enabled
                    if (this.startDate.format('YYYY-MM-DD') == this.ranges[range][0].format('YYYY-MM-DD') && this.endDate.format('YYYY-MM-DD') == this.ranges[range][1].format('YYYY-MM-DD')) {
                        customRange = false;
                        this.chosenLabel = this.container.find('.ranges li:eq(' + i + ')')
                            .addClass('active').html();
                    }
                }
                i++;
            }
            if (customRange) {
                this.chosenLabel = this.container.find('.ranges li:last').addClass('active').html();
                this.showCalendars();
            }

          var fromLabel = this.locale.fromLabel;
          var toLabel = this.locale.toLabel;
          var startDate = this.startDate.format('MMM D YYYY');
          var endDate = this.endDate.format('MMM D YYYY');
          var leftMessage  = this.snapMessageLeft;
          var rightMessage = this.snapMessageRight;

          this.container.find('.calendar').each(function( index, calendar ) {

              if ($(calendar).hasClass('left')) {
                  $(calendar).find('.calendar-datetime> .labels').html(fromLabel);
                  $(calendar).find('.calendar-datetime> .selection span').html(startDate);
                  $(calendar).find('.calendar-datetime> .spanInfoLeft span').html(leftMessage);
              }else{
                  $(calendar).find('.calendar-datetime> .labels').html(toLabel);
                  $(calendar).find('.calendar-datetime> .selection span').html(endDate);
                  $(calendar).find('.calendar-datetime> .spanInfoRight span').html(rightMessage);
              }
          });

          this.container.find('.range_labels span').html(this.startDate.format(this.format) + ', ' + this.endDate.format(this.format));
          if(this.selectedRangeSlow)
          {
            this.container.find('.range_serverTime span').html('This call will be slow');
          }
          else
          {
            this.container.find('.range_serverTime span').html('This call will be fast');
          }
          this.container.find('.range_gran span').html(this.currentGran);
          
        },

        buildCalendar: function (month, year, hour, minute, side) {
            var daysInMonth = moment([year, month]).daysInMonth();
            var firstDay = moment([year, month, 1]);
            //firstDay.utcOffset(this.timezone);
            var lastDay = moment([year, month, daysInMonth]);
            //lastDay.utcOffset(this.timezone);
            var lastMonth = moment(firstDay).subtract(1, 'month').month();
            var lastYear = moment(firstDay).subtract(1, 'month').year();

            var daysInLastMonth = moment([lastYear, lastMonth]).daysInMonth();

            var dayOfWeek = firstDay.day();

            var i;

            //initialize a 6 rows x 7 columns array for the calendar
            var calendar = [];
            calendar.firstDay = firstDay;
            calendar.lastDay = lastDay;

            calendar.side = side;
            calendar.minHour = (side == 'left') ? this.minDate.hour() : 0;
            calendar.maxHour = (side == 'right') ? this.maxDate.hour() : 23;
            calendar.minMinute = (side == 'left') ? this.minDate.minute() : 0;
            calendar.maxMinute = (side == 'right') ? this.maxDate.minute() : 23;
            for (i = 0; i < 6; i++) {
                calendar[i] = [];
            }

            //populate the calendar with date objects
            var startDay = daysInLastMonth - dayOfWeek + this.locale.firstDay + 1;
            if (startDay > daysInLastMonth)
                startDay -= 7;

            if (dayOfWeek == this.locale.firstDay)
                startDay = daysInLastMonth - 6;

            var curDate = moment([lastYear, lastMonth, startDay, 12, minute]);
         //   curDate.utcOffset(this.timezone);
            var col, row;
            for (i = 0, col = 0, row = 0; i < 42; i++, col++, curDate = moment(curDate).add(24, 'hour')) {
                if (i > 0 && col % 7 === 0) {
                    col = 0;
                    row++;
                }
                calendar[row][col] = curDate.clone().hour(hour);
             //   calendar[row][col].utcOffset(this.timezone);
                curDate.hour(12);
            }

            return calendar;
        },

        renderDropdowns: function (selected, minDate, maxDate) {
            var currentMonth = selected.month();
            var monthHtml = '<select class="monthselect">';
            var inMinYear = false;
            var inMaxYear = false;

            for (var m = 0; m < 12; m++) {
                if ((!inMinYear || m >= minDate.month()) && (!inMaxYear || m <= maxDate.month())) {
                    monthHtml += "<option value='" + m + "'" +
                        (m === currentMonth ? " selected='selected'" : "") +
                        ">" + this.locale.monthNames[m] + "</option>";
                }
            }
            monthHtml += "</select>";

            var currentYear = selected.year();
            var maxYear = (maxDate && maxDate.year()) || (currentYear + 5);
            var minYear = (minDate && minDate.year()) || (currentYear - 50);
            var yearHtml = '<select class="yearselect">';

            for (var y = minYear; y <= maxYear; y++) {
                yearHtml += '<option value="' + y + '"' +
                    (y === currentYear ? ' selected="selected"' : '') +
                    '>' + y + '</option>';
            }

            yearHtml += '</select>';

            return monthHtml + yearHtml;
        },

        renderCalendar: function (calendar, selected, minDate, maxDate) {
            var html =  '<div class="calendar-datetime">';
            html +=  '<div class="labels"></div>';
            html += '</div>';
            html += '<div class="calendar-date">';
            html += '<table class="table-condensed">';
            html += '<thead>';
            html += '<tr class="header">';

            // add empty cell for week number
            if (this.showWeekNumbers)
                html += '<th></th>';

            if (!minDate || minDate.isBefore(calendar.firstDay)) {
                html += '<th class="prev available"><img class="fa fa-arrow-left icon-arrow-left glyphicon" src="images/leftArrow.svg"/></th>';
            } else {
                html += '<th><img class=" glyphicon" src="images/leftArrowdisabled.svg"/></th>';
            }

            var dateHtml = this.locale.monthNames[calendar[1][1].month()] + calendar[1][1].format(" YYYY");

            if (this.showDropdowns) {
                dateHtml = this.renderDropdowns(calendar[1][1], minDate, maxDate);
            }

            html += '<th colspan="5" class="month">' + dateHtml + '</th>';
            if (!maxDate || maxDate.isAfter(calendar.lastDay)) {
                html += '<th class="next available"><img class="fa fa-arrow-left icon-arrow-left glyphicon" src="images/rightArrow.svg"/></i></th>';
            } else {
                html += '<th><img class=" glyphicon" src="images/rightArrowdisabled.svg"/></th>';
            }

            html += '</tr>';
            html += '<tr>';

            // add week number label
            if (this.showWeekNumbers)
                html += '<th class="week calendarTableBorder">' + this.locale.weekLabel + '</th>';

            $.each(this.locale.daysOfWeek, function (index, dayOfWeek) {
                html += '<th class="calendarTableBorder">' + dayOfWeek + '</th>';
            });

            html += '</tr>';
            html += '</thead>';
            html += '<tbody>';

            for (var row = 0; row < 6; row++) {
                html += '<tr>';

                // add week number
                if (this.showWeekNumbers)
                    html += '<td class="week">' + calendar[row][0].week() + '</td>';

                for (var col = 0; col < 7; col++) {
                    var cname = 'available ';
                    cname += (calendar[row][col].month() == calendar[1][1].month()) ? '' : 'off';

                    if ((minDate && calendar[row][col].isBefore(minDate, 'day')) || (maxDate && calendar[row][col].isAfter(maxDate, 'day'))) {
                        cname = ' off disabled ';
                    } else if (calendar[row][col].format('YYYY-MM-DD') == selected.format('YYYY-MM-DD')) {
                        cname += ' active ';
                        if (calendar[row][col].format('YYYY-MM-DD') == this.startDate.format('YYYY-MM-DD')) {
                            cname += ' start-date ';
                        }
                        if (calendar[row][col].format('YYYY-MM-DD') == this.endDate.format('YYYY-MM-DD')) {
                            cname += ' end-date ';
                        }
                    } else if (calendar[row][col] >= this.startDate && calendar[row][col] <= this.endDate) {
                        cname += ' in-range ';
                        if (calendar[row][col].isSame(this.startDate)) { cname += ' start-date '; }
                        if (calendar[row][col].isSame(this.endDate)) { cname += ' end-date '; }
                    }
                    cname += 'calendarTableBorder';
                    var title = 'r' + row + 'c' + col;
                    html += '<td class="' + cname.replace(/\s+/g, ' ').replace(/^\s?(.*?)\s?$/, '$1') + '" data-title="' + title + '">' + calendar[row][col].date() + '</td>';
                }
                html += '</tr>';
            }

            html += '</tbody>';
            html += '</table>';
            html += '</div>';
          

            html += '<div class="calendar-datetime">' +
            '   <div class="selection">' +
            '       <span class=""></span>&nbsp';
            
          
                var i;
                if (this.timePicker) {
                    //html += '<div class="calendar-datetime">';
                      if(this.hourGranAllowed)
                    {
                        html += '     <select class="hourselect">';
                    }
                    else
                    {
                        html += '     <select class="hourselect" style="visibility:hidden">';
                    }

                  var selected_hour = selected.hour();
                  if (this.timePicker12Hour) {
                    start = 1;
                    end = 12;
                    if (selected_hour >= 12)
                      selected_hour -= 12;
                    if (selected_hour === 0)
                      selected_hour = 12;
                  }

                  var start = 0,
                      end = 23;
                    var startMin = 0,
                        endMin = 59;  

                  if(calendar.side == 'left'){
                    start = (this.minDate && this.minDate.format('YYYY-MM-DD') == selected.format('YYYY-MM-DD'))? calendar.minHour : 0;
                    end = (this.maxDate && this.maxDate.format('YYYY-MM-DD') == selected.format('YYYY-MM-DD'))? this.rightCalendar.calendar.maxHour - 1 : 23;
                    startMin = (this.minDate && this.minDate.format('YYYY-MM-DD hh') == selected.format('YYYY-MM-DD hh'))? calendar.minMinute : 0;
                    endMin = (this.maxDate && this.maxDate.format('YYYY-MM-DD hh') == selected.format('YYYY-MM-DD hh'))? this.rightCalendar.calendar.maxMinute - 1 : 59;
                    
                    if(this.maxDate && this.maxDate.isBefore(this.startDate)) {
                      this.startDate = moment(this.maxDate).startOf('day');
                      return this.renderCalendar(calendar, this.startDate, minDate, maxDate);
                    }

                  }else{
                    start = (this.minDate && this.minDate.format('YYYY-MM-DD') == selected.format('YYYY-MM-DD'))? this.leftCalendar.calendar.minHour + 1 : 0;
                    end = (this.maxDate && this.maxDate.format('YYYY-MM-DD') == selected.format('YYYY-MM-DD'))? calendar.maxHour : 23;
                    startMin = (this.minDate && this.minDate.format('YYYY-MM-DD hh') == selected.format('YYYY-MM-DD hh'))? this.leftCalendar.calendar.minMinute + 1 : 0;
                    endMin = (this.maxDate && this.maxDate.format('YYYY-MM-DD hh') == selected.format('YYYY-MM-DD hh'))? calendar.maxMinute : 59;

                    if(this.maxDate && this.maxDate.isBefore(this.endDate)) {
                      this.endDate = this.maxDate;
                      return this.renderCalendar(calendar, this.endDate, minDate, maxDate);
                    }

                    if(selected.format('YYYY-MM-DD') == this.startDate.format('YYYY-MM-DD')){
                      start = this.startDate.hour() + 1;
                      if(start == 24){
                        this.endDate = moment(this.startDate).add(1,'hour');

                        if(this.maxDate && this.maxDate.isBefore(this.endDate)) {
                          this.endDate = this.maxDate;
                        }

                        return this.renderCalendar(calendar, this.endDate, minDate, maxDate);
                      }
                    }
                  }

                  for (i = start; i <= end; i++) {
                      var hour = (i < 10) ? '0' : '';
                      hour += i;
                      if (i == selected_hour) {
                        html += '       <option value="' + i + '" selected="selected">' + hour + '</option>';
                      } else {
                        html += '       <option value="' + i + '">' + hour + '</option>';
                      }
                  }

                  html += '   </select>';

                  if (this.includeMinutes) {
                    html += ': ';
                    if(this.hourGranAllowed)
                    {
                        html += '   <select class="minuteselect">';
                    }
                    else
                    {
                        html += '   <select class="minuteselect" style="visibility:hidden">';
                    }

                    for (i = startMin; i <= endMin; i += this.timePickerIncrement) {
                      var num = i;
                      if (num < 10)
                        num = '0' + num;
                      if (i == selected.minute()) {
                        html += '       <option value="' + i + '" selected="selected">' + num + '</option>';
                      } else {
                        html += '       <option value="' + i + '">' + num + '</option>';
                      }
                    }

                    html += '   </select>  ';
                  }else{
                    html += ':00';
                  }

                  if (this.timePicker12Hour) {
                      html += '   <select class="ampmselect">';
                      if (selected.hour() >= 12) {
                          html += '       <option value="AM">AM</option><option value="PM" selected="selected">PM</option>';
                      } else {
                          html += '       <option value="AM" selected="selected">AM</option><option value="PM">PM</option>';
                      }
                      html += '   </select>';
                  }

                  //html += '</div>';

                }


                html += '   </div>';
                if(calendar.side == 'left')
                {
                   html += '  <div class="spanInfoLeft">'+
                      '         <span class=""></span>'+
                      '        </div>&nbsp;';
                    html += '</div>';
                }
                else
                {
                   html += '  <div class="spanInfoRight">'+
                      '         <span class=""></span>'+
                      '        </div>&nbsp;';
                    html += '</div>';
                }

            return html;

        },

        remove: function() {

            this.container.remove();
            this.element.off('.daterangepicker');
            this.element.removeData('daterangepicker');

        }

    };

    $.fn.daterangepicker = function (options, cb) {
        this.each(function () {
            var el = $(this);
            if (el.data('daterangepicker'))
                el.data('daterangepicker').remove();
            el.data('daterangepicker', new DateRangePicker(el, options, cb));
        });
        return this;
    };

}));
