/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2018 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */
import React from 'react';
import { Alert, Button, Modal } from 'patternfly-react';
import cockpit from 'cockpit';

import * as Select from "cockpit-components-select.jsx";

import { units, convertToUnit, digitFilter, toFixedPrecision } from '../helpers.es6';
import { volumeCreateAndAttach, attachDisk, getVm, getStoragePools } from '../actions/provider-actions.es6';

import './diskAdd.css';

const _ = cockpit.gettext;

const CREATE_NEW = 'create-new';
const USE_EXISTING = 'use-existing';

function getAvailableTargets(vm) {
    const existingTargets = Object.getOwnPropertyNames(vm.disks);
    const targets = [];
    let i = 0;
    while (i < 26 && targets.length < 5) {
        const target = `vd${String.fromCharCode(97 + i)}`;
        if (!existingTargets.includes(target)) {
            targets.push(target);
        }
        i++;
    }
    return targets;
}

function getFilteredVolumes(vmStoragePool, disks) {
    const usedDiskPaths = Object.getOwnPropertyNames(disks)
            .filter(target => disks[target].source && disks[target].source.file)
            .map(target => disks[target].source.file);

    const filteredVolumes = vmStoragePool.filter(volume => !usedDiskPaths.includes(volume.path));

    const filteredVolumesSorted = filteredVolumes.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    return filteredVolumesSorted;
}

const SelectExistingVolume = ({ idPrefix, dialogValues, onValueChanged, vmStoragePools, vmDisks }) => {
    const vmStoragePool = vmStoragePools[dialogValues.storagePoolName];
    const filteredVolumes = getFilteredVolumes(vmStoragePool, vmDisks);

    let initiallySelected;
    let content;
    if (filteredVolumes.length > 0) {
        content = filteredVolumes.map(volume => {
            return (
                <Select.SelectEntry data={volume.name} key={volume.name}>
                    {volume.name}
                </Select.SelectEntry>
            );
        });
        initiallySelected = dialogValues.existingVolumeName;
    } else {
        content = (
            <Select.SelectEntry data="empty" key="empty-list">
                <i>{_("The pool is empty")}</i>
            </Select.SelectEntry>
        );
        initiallySelected = "empty";
    }

    return (
        <div className="row">
            <div className="col-sm-1 dialog-field">
                <label htmlFor={`${idPrefix}-select-volume`}>
                    {_("Volume")}
                </label>
            </div>
            <div className="col-sm-11 dialog-field">
                <Select.Select id={`${idPrefix}-select-volume`}
                               onChange={value => onValueChanged('existingVolumeName', value)}
                               initial={initiallySelected}
                               enabled={filteredVolumes.length > 0}
                               extraClass='form-control'>
                    {content}
                </Select.Select>
            </div>
        </div>
    );
};

const PermanentChange = ({ idPrefix, onValueChanged, dialogValues, provider, vm }) => {
    // By default for a running VM, the disk is attached until shut down only. Enable permanent change of the domain.xml
    if (!provider.isRunning(vm.state)) {
        return null;
    }

    return (
        <div className="row">
            <div className="col-sm-1 dialog-field" />

            <div className="col-sm-11 dialog-field add-disk-attach-perm">
                <input id={`${idPrefix}-permanent`}
                       type="checkbox"
                       checked={dialogValues.permanent}
                       onChange={e => onValueChanged('permanent', e.target.checked)} />
                <label>
                    {_("Attach permanently")}
                </label>
            </div>
        </div>
    );
};

const VolumeName = ({ idPrefix, dialogValues, onValueChanged }) => {
    return (
        <div className="row">
            <div className="col-sm-1 dialog-field">
                <label htmlFor={`${idPrefix}-name`}>
                    {_("Name")}
                </label>
            </div>
            <div className="col-sm-11 dialog-field">
                <input id={`${idPrefix}-name`}
                       className="form-control"
                       type="text"
                       minLength={1}
                       placeholder={_("New Volume Name")}
                       value={dialogValues.volumeName || ""}
                       onChange={e => onValueChanged('volumeName', e.target.value)} />

            </div>
        </div>
    );
};

const VolumeDetails = ({ idPrefix, onValueChanged, dialogValues }) => {
    return (
        <div className="row">
            <div className="col-sm-1 dialog-field">
                <label htmlFor={`${idPrefix}-size`}>
                    {_("Size")}
                </label>
            </div>
            <div className="col-sm-3 dialog-field">
                <input id={`${idPrefix}-size`}
                       className="form-control add-disk-size"
                       type="number"
                       value={toFixedPrecision(dialogValues.size)}
                       onKeyPress={digitFilter}
                       step={1}
                       min={0}
                       onChange={e => onValueChanged('size', e.target.value)} />

                <Select.Select id={`${idPrefix}-unit`}
                               initial={dialogValues.unit}
                               onChange={value => onValueChanged('unit', value)}>
                    <Select.SelectEntry data={units.MiB.name} key={units.MiB.name}>
                        {_("MiB")}
                    </Select.SelectEntry>
                    <Select.SelectEntry data={units.GiB.name} key={units.GiB.name}>
                        {_("GiB")}
                    </Select.SelectEntry>
                </Select.Select>
            </div>

            <div className="col-sm-4 dialog-field add-disk-file-format">
                <label htmlFor={`${idPrefix}-fileformat`}>
                    {_("Format")}
                </label>
                <Select.Select id={`${idPrefix}-diskfileformat`}
                               onChange={value => onValueChanged('diskFileFormat', value)}
                               initial={dialogValues.diskFileFormat}
                               extraClass='form-control'>
                    <Select.SelectEntry data='qcow2' key='qcow2'>
                        {_("qcow2")}
                    </Select.SelectEntry>
                    <Select.SelectEntry data='raw' key='raw'>
                        {_("raw")}
                    </Select.SelectEntry>
                </Select.Select>
            </div>

            <div className="col-sm-4" />
        </div>
    );
};

const PoolAndTargetRow = ({ idPrefix, onValueChanged, dialogValues, vmStoragePools }) => {
    return (
        <div className="row">
            <div className="col-sm-1 dialog-field">
                <label htmlFor={`${idPrefix}-select-pool`}>
                    {_("Pool")}
                </label>
            </div>
            <div className="col-sm-5 dialog-field">
                <Select.Select id={`${idPrefix}-select-pool`}
                               onChange={value => onValueChanged('storagePoolName', value)}
                               initial={dialogValues.storagePoolName}
                               extraClass="form-control">
                    {Object.getOwnPropertyNames(vmStoragePools)
                            .sort((a, b) => a.localeCompare(b))
                            .map(poolName => {
                                return (
                                    <Select.SelectEntry data={poolName} key={poolName}>
                                        {poolName}
                                    </Select.SelectEntry>
                                );
                            })}
                </Select.Select>
            </div>

            <div className="col-sm-6 dialog-field add-disk-target">
                <label htmlFor={`${idPrefix}-target`}>
                    {_("Target")}
                </label>
                <Select.Select id={`${idPrefix}-target`}
                               onChange={value => onValueChanged('target', value)}
                               initial={dialogValues.target}
                               extraClass="form-control">
                    {dialogValues.availableTargets.map(target => {
                        return (
                            <Select.SelectEntry data={target} key={target}>
                                {target}
                            </Select.SelectEntry>
                        );
                    })}
                </Select.Select>
            </div>
        </div>
    );
};

const CreateNewDisk = ({ idPrefix, onValueChanged, dialogValues, vmStoragePools, provider, vm }) => {
    return (
        <div className='container-fluid add-disk-body'>
            <PoolAndTargetRow idPrefix={idPrefix}
                              dialogValues={dialogValues}
                              onValueChanged={onValueChanged}
                              vmStoragePools={vmStoragePools} />

            <VolumeName idPrefix={idPrefix} dialogValues={dialogValues} onValueChanged={onValueChanged} />
            <VolumeDetails idPrefix={idPrefix} dialogValues={dialogValues} onValueChanged={onValueChanged} />
            <PermanentChange idPrefix={idPrefix} dialogValues={dialogValues} onValueChanged={onValueChanged} provider={provider} vm={vm} />
        </div>
    );
};

const UseExistingDisk = ({ idPrefix, onValueChanged, dialogValues, vmStoragePools, provider, vm }) => {
    return (
        <div className='container-fluid add-disk-body'>
            <PoolAndTargetRow idPrefix={idPrefix}
                              dialogValues={dialogValues}
                              onValueChanged={onValueChanged}
                              vmStoragePools={vmStoragePools} />

            <SelectExistingVolume idPrefix={idPrefix} dialogValues={dialogValues} onValueChanged={onValueChanged} vmStoragePools={vmStoragePools} vmDisks={vm.disks} />
            <PermanentChange idPrefix={idPrefix} dialogValues={dialogValues} onValueChanged={onValueChanged} provider={provider} vm={vm} />
        </div>
    );
};

function getDiskFileName(storagePools, vm, poolName, volumeName) {
    const vmStoragePools = storagePools[vm.connectionName];
    let volume;
    if (vmStoragePools && vmStoragePools[poolName]) {
        volume = vmStoragePools[poolName].find(volume => volume.name === volumeName);
    }
    return volume && volume.path;
}

export class AddDiskAction extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showModal: false };
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
    }

    close() {
        this.setState({ showModal: false });
    }

    open() {
        // Refresh storage volume list before displaying the dialog.
        // There are recently no Libvirt events for storage volumes and polling is ugly.
        // https://bugzilla.redhat.com/show_bug.cgi?id=1578836
        this.props.dispatch(getStoragePools(this.props.vm.connectionName))
                .then(() => {
                    this.setState({ showModal: true });
                });
    }

    render() {
        const { vm, storagePools, provider, dispatch } = this.props;
        const idPrefix = `${this.props.idPrefix}-adddisk`;

        return (
            <div id={`${idPrefix}-add-dialog-full`}>
                <Button id={`${idPrefix}`} bsStyle='primary' onClick={this.open} className='pull-right' >
                    {_("Add Disk")}
                </Button>
                { this.state.showModal && <AddDiskModalBody close={this.close} dispatch={dispatch} idPrefix={this.props.idPrefix} vm={vm} storagePools={storagePools} provider={provider} /> }
            </div>
        );
    }
}

class AddDiskModalBody extends React.Component {
    constructor(props) {
        super(props);
        this.state = this.initialState;
        this.onValueChanged = this.onValueChanged.bind(this);
        this.dialogErrorSet = this.dialogErrorSet.bind(this);
        this.dialogErrorDismiss = this.dialogErrorDismiss.bind(this);
        this.onAddClicked = this.onAddClicked.bind(this);
        this.getDefaultVolumeName = this.getDefaultVolumeName.bind(this);
    }

    get initialState() {
        const { vm, storagePools, provider } = this.props;
        const availableTargets = getAvailableTargets(vm);

        return {
            storagePoolName: storagePools && storagePools[vm.connectionName] && Object.getOwnPropertyNames(storagePools[vm.connectionName]).sort()[0],
            mode: CREATE_NEW,
            volumeName: undefined,
            existingVolumeName: undefined,
            size: 1,
            unit: units.GiB.name,
            diskFileFormat: 'qcow2',
            target: availableTargets[0],
            permanent: !provider.isRunning(vm.state), // default true for a down VM; for a running domain, the disk is attached tentatively only
            hotplug: provider.isRunning(vm.state), // must be kept false for a down VM; the value is not being changed by user
            availableTargets, // for optimization
        };
    }

    getDefaultVolumeName(poolName) {
        const { storagePools, vm } = this.props;
        const vmStoragePools = storagePools[vm.connectionName];
        const vmStoragePool = vmStoragePools[poolName];
        const filteredVolumes = getFilteredVolumes(vmStoragePool, vm.disks);
        return filteredVolumes[0] && filteredVolumes[0].name;
    }

    onValueChanged(key, value) {
        const stateDelta = { [key]: value };

        if (key === 'storagePoolName' && this.state.mode === USE_EXISTING) { // user changed pool
            stateDelta.existingVolumeName = this.getDefaultVolumeName(value);
        }

        if (key === 'mode' && value === USE_EXISTING) { // user moved to USE_EXISTING subtab
            const poolName = this.state.storagePoolName;
            stateDelta.existingVolumeName = this.getDefaultVolumeName(poolName);
        }

        this.setState(stateDelta);
    }

    dialogErrorSet(text) {
        this.setState({ dialogError: text });
    }

    dialogErrorDismiss() {
        this.setState({ dialogError: undefined });
    }

    onAddClicked() {
        const { vm, dispatch, storagePools } = this.props;

        if (this.state.mode === CREATE_NEW) {
            // validate
            if (!this.state.volumeName) {
                return this.dialogErrorSet(_("Please enter new volume name"));
            }
            if (!(this.state.size > 0)) { // must be positive number
                return this.dialogErrorSet(_("Please enter new volume size"));
            }

            // create new disk
            return dispatch(volumeCreateAndAttach({ connectionName: vm.connectionName,
                                                    poolName: this.state.storagePoolName,
                                                    volumeName: this.state.volumeName,
                                                    size: convertToUnit(this.state.size, this.state.unit, 'MiB'),
                                                    format: this.state.diskFileFormat,
                                                    target: this.state.target,
                                                    permanent: this.state.permanent,
                                                    hotplug: this.state.hotplug,
                                                    vmName: vm.name,
                                                    vmId: vm.id }))
                    .fail(exc => this.dialogErrorSet(_("Disk failed to be created with following error: ") + exc.message))
                    .then(() => { // force reload of VM data, events are not reliable (i.e. for a down VM)
                        this.props.close();
                        return dispatch(getVm({connectionName: vm.connectionName, name: vm.name, id: vm.id}));
                    });
        }

        // use existing volume
        return dispatch(attachDisk({ connectionName: vm.connectionName,
                                     diskFileName: getDiskFileName(storagePools, vm, this.state.storagePoolName, this.state.existingVolumeName),
                                     target: this.state.target,
                                     permanent: this.state.permanent,
                                     hotplug: this.state.hotplug,
                                     vmName: vm.name,
                                     vmId: vm.id }))
                .fail(exc => this.dialogErrorSet(_("Disk failed to be attached with following error: ") + exc.message))
                .then(() => { // force reload of VM data, events are not reliable (i.e. for a down VM)
                    this.props.close();
                    return dispatch(getVm({connectionName: vm.connectionName, name: vm.name, id: vm.id}));
                });
    }

    render() {
        const { vm, storagePools, provider } = this.props;
        const idPrefix = `${this.props.idPrefix}-adddisk`;
        const vmStoragePools = storagePools[vm.connectionName];

        const defaultBody = (
            <div className='modal-body add-disk-dialog'>
                <div className="container-fluid">
                    <div className="row">
                        <div className="col-sm-1 dialog-field add-disk-source-label">
                            <label className="control-label" htmlFor={`${idPrefix}-source`}>
                                {_("Source")}
                            </label>
                        </div>
                        <div className="col-sm-11 dialog-field add-disk-source" id={`${idPrefix}-source`}>
                            <div key='one' className="col-sm-3 add-disk-select-source">
                                <input id={`${idPrefix}-createnew`}
                                       type="radio"
                                       name="source"
                                       checked={this.state.mode === CREATE_NEW}
                                       onChange={e => this.onValueChanged('mode', CREATE_NEW)}
                                       className={this.state.mode === CREATE_NEW ? "active" : ''} />
                                <label className="control-label" htmlFor={`${idPrefix}-createnew`}>
                                    {_("Create New")}
                                </label>
                            </div>

                            <div key='two' className="col-sm-3 add-disk-select-source">
                                <input id={`${idPrefix}-useexisting`}
                                       type="radio"
                                       name="source"
                                       checked={this.state.mode === USE_EXISTING}
                                       onChange={e => this.onValueChanged('mode', USE_EXISTING)}
                                       className={this.state.mode === USE_EXISTING ? "active" : ''} />
                                <label className="control-label" htmlFor={`${idPrefix}-useexisting`}>
                                    {_("Use Existing")}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                {this.state.mode === CREATE_NEW && (
                    <CreateNewDisk idPrefix={`${idPrefix}-new`}
                                   onValueChanged={this.onValueChanged}
                                   dialogValues={this.state}
                                   vmStoragePools={vmStoragePools}
                                   provider={provider}
                                   vm={vm} />
                )}
                {this.state.mode === USE_EXISTING && (
                    <UseExistingDisk idPrefix={`${idPrefix}-existing`}
                                     onValueChanged={this.onValueChanged}
                                     dialogValues={this.state}
                                     vmStoragePools={vmStoragePools}
                                     provider={provider}
                                     vm={vm} />
                )}
            </div>
        );

        return (
            <Modal id={`${idPrefix}-dialog-modal-window`} show onHide={this.props.close}>
                <Modal.Header>
                    <Modal.CloseButton onClick={this.props.close} />
                    <Modal.Title> {`Add Disk`} </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.state.dialogError && (<Alert onDismiss={this.dialogErrorDismiss}> {this.state.dialogError} </Alert>)}
                    {defaultBody}
                </Modal.Body>
                <Modal.Footer>
                    <Button id={`${idPrefix}-dialog-cancel`} bsStyle='default' className='btn-cancel' onClick={this.props.close}>
                        {_("Cancel")}
                    </Button>
                    <Button id={`${idPrefix}-dialog-add`} bsStyle='primary' onClick={this.onAddClicked}>
                        {_("Add")}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
